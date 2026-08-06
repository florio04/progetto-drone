from fastapi import FastAPI, WebSocket, WebSocketDisconnect 
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import paho.mqtt.client as mqtt
import asyncio # Asynchrony management for WebSockets
import json

app = FastAPI(title="MQTT-Web Gateway") 

# Mount the 'js' directory to make static files (like your main.js or clustering.js) available to the web app
app.mount("/js", StaticFiles(directory="js"), name="js")

# ENDPOINT FOR THE WEB PAGE (Serves the main HTML interface)
@app.get("/")
async def get_web_page():
    return FileResponse("index.html")

# ENDPOINT FOR THE CSS (Serves the stylesheet)
@app.get("/style.css")
async def get_css():
    return FileResponse("style.css")


# ==========================================
# GATEWAY CORE: WEBSOCKET + MQTT BRIDGE
# ==========================================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # Accept the incoming WebSocket connection from the browser
    await websocket.accept() 
    
    # We need the current event loop because Paho MQTT runs its callbacks in a separate background thread.
    # We will use this loop to safely send messages back to the asynchronous WebSocket.
    loop = asyncio.get_running_loop()
    mqtt_client = None

    # Callback: What Paho does when it receives a message from the MQTT broker
    def on_message(client, userdata, msg):
        received_text = msg.payload.decode('utf-8')
        
        # AGGIORNAMENTO: Passiamo i messaggi JSON "puri" al frontend senza tag HTML per tutto ciò che riguarda il drone.
        # Questo permette a collegamento.js di eseguire correttamente il JSON.parse() su telemetria e foto (Base64).
        if msg.topic.startswith("drone/"):
            asyncio.run_coroutine_threadsafe(websocket.send_text(received_text), loop)
        else:
            # Per log di sistema o topic generici non-drone, manteniamo lo styling HTML
            formatted_message = f"<span class='topic'>[{msg.topic}]</span> {received_text}"
            asyncio.run_coroutine_threadsafe(websocket.send_text(formatted_message), loop)

    try:
        # Keep the WebSocket connection open and listen for incoming messages from the browser
        while True:
            # We receive the JSON payload from the web interface
            raw_data = await websocket.receive_text()
            received_data = json.loads(raw_data) 
            
            # Extract the TYPE of action requested by the web page. 
            # If the "action" key is missing, default to "connect".
            action = received_data.get("action", "connect")
            
            # ==========================================
            # ACTION 1: BROKER CONNECTION
            # ==========================================
            if action == "connect":
                # Extract connection parameters provided by the user in the UI
                broker_address = received_data.get("broker")
                conn_type = received_data.get("connection_type", "standard")
                broker_username = received_data.get("username", "")
                broker_password = received_data.get("password", "")
                requested_topic = received_data.get("topic", "#")
                
                # If there is already an active MQTT connection, stop and disconnect it first
                if mqtt_client:
                    mqtt_client.loop_stop()
                    mqtt_client.disconnect()
                
                # Callback: Triggered when the broker accepts or rejects our connection attempt
                def on_connect(client, userdata, flags, reason_code, properties):
                    if reason_code == 0:
                        # Connection successful
                        msg = f"<span style='color:#3b82f6'>[SYSTEM] Connected! Subscribed to topic: {requested_topic}</span>"
                        asyncio.run_coroutine_threadsafe(websocket.send_text(msg), loop)
                        
                        # Subscribe to the specific topic requested by the user
                        client.subscribe(requested_topic) 
                        
                        # Questo garantisce la ricezione delle foto Base64 anche se l'utente cambia topic.
                        client.subscribe("drone/photo")
                    else:
                        # Connection failed (e.g., bad credentials)
                        msg = f"<span style='color:red'>[ERROR] Unable to connect (Code: {reason_code})</span>"
                        asyncio.run_coroutine_threadsafe(websocket.send_text(msg), loop)

                # Initialize the new Paho MQTT client (using v2 API standard)
                mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
                mqtt_client.on_connect = on_connect
                mqtt_client.on_message = on_message
                
                # Configure port and TLS/SSL encryption based on the selected profile
                if conn_type == "secure":
                    port = 8883
                    mqtt_client.tls_set() # Enable secure encryption for Cloud (HiveMQ)
                else:
                    port = 1883 # Standard unencrypted port for localhost/LAN
                    
                # Set credentials if provided
                if broker_username:
                    mqtt_client.username_pw_set(broker_username, broker_password)
                
                try:
                    # Attempt connection and start the background thread for network traffic
                    mqtt_client.connect(broker_address, port, 60)
                    mqtt_client.loop_start()
                except Exception as e:
                    # Handle severe network errors (e.g., wrong IP or broker completely offline)
                    error_msg = f"<span style='color:red'>[CRITICAL ERROR] Failed to connect to broker: {str(e)}. Check IP and Port.</span>"
                    await websocket.send_text(error_msg)
                    mqtt_client = None
            
            elif action == "command":
                target_topic = received_data.get("target_topic", "drone/commands")
                payload = received_data.get("payload")
                
                if mqtt_client and payload:
                    mqtt_client.publish(target_topic, payload)
                    # Log di conferma sul terminale della Web App
                    msg = f"<span style='color:#f59e0b'>[CMD OUT ➔ {target_topic}]</span> {payload}"
                    asyncio.run_coroutine_threadsafe(websocket.send_text(msg), loop)

                    
    except WebSocketDisconnect:
        # Graceful shutdown: if the user closes the browser tab, stop the MQTT client
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        print("Web page closed, client disconnected.")