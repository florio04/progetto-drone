/* ============================================================
   GCS AND WEBSOCKET LOGIC (Aggiornato per Streaming HTTP MJPEG & Base64)
   ============================================================ */
const GCS = (() => {
    let ws = null;
    let terminal = null;
    let isStreamingActive = false;
    let isHttpStreamMode = false; // Flag per distinguere lo stream HTTP da quello MQTT Base64

    function setStatus(online) {
        document.querySelectorAll('.status-dot').forEach(d => {
            d.className = 'status-dot ' + (online ? 'online' : 'offline');
        });
        document.querySelectorAll('.status-text').forEach(el => {
            el.textContent = online ? 'ONLINE — Connected' : 'OFFLINE — Disconnected';
            el.style.color = online ? 'var(--green)' : 'var(--red)';
        });
        sessionStorage.setItem('gcs_online', online ? '1' : '0');

        const videoImg = document.getElementById('live-video');
        const offlineText = document.getElementById('offline-text');
        
        if (videoImg) {
            if (online) {
                if (offlineText && !isStreamingActive) {
                    offlineText.textContent = 'IN ATTESA DI FOTO DA MQTT O STREAM HTTP...';
                    offlineText.style.display = 'block';
                }
            } else {
                // Se andiamo offline e non stiamo usando uno stream HTTP esterno attivo
                if (!isHttpStreamMode) {
                    isStreamingActive = false;
                    videoImg.src = "";
                    videoImg.style.display = 'none';
                    if (offlineText) {
                        offlineText.textContent = 'CAMERA FEED OFFLINE';
                        offlineText.style.display = 'block';
                    }
                }
            }
        }
    }

    function log(html, cls = '') {
        if (!terminal) terminal = document.getElementById('terminal');
        if (!terminal) return;
        const d = document.createElement('div');
        d.className = 'msg' + (cls ? ' ' + cls : '');
        d.innerHTML = html;
        terminal.appendChild(d);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function clearTerminal() {
        if (!terminal) terminal = document.getElementById('terminal');
        if (terminal) terminal.innerHTML = '<div class="msg" style="color:var(--text-muted); font-style:italic;">Log cleared.</div>';
    }

    
    function updateHUDFromTelemetry(msgStr) {
        if (!msgStr) return;

        try {
            const data = JSON.parse(msgStr);

            // Supporta sia 'altitude' (inviato da Kotlin) che 'alt'
            const currentAlt = data.altitude !== undefined ? data.altitude : data.alt;
            if (currentAlt !== undefined && document.getElementById('hud-alt')) {
                document.getElementById('hud-alt').textContent = `ALT: ${parseFloat(currentAlt).toFixed(1)} m`;
            }

            if (data.bat !== undefined && document.getElementById('hud-bat')) {
                let badge = document.getElementById('hud-bat');
                badge.textContent = `BAT: ${data.bat}%`;
                badge.className = data.bat < 30 ? 'hud-badge red' : 'hud-badge amber';
            }

            if (data.speed !== undefined && document.getElementById('hud-speed')) {
                document.getElementById('hud-speed').textContent = `SPD: ${data.speed} km/h`;
            }

            if (data.lat !== undefined && data.lon !== undefined && document.getElementById('hud-gps')) {
                document.getElementById('hud-gps').textContent = `GPS: ${parseFloat(data.lat).toFixed(6)}, ${parseFloat(data.lon).toFixed(6)}`;

                const mapIframe = document.querySelector('#map-tab iframe');
                if (mapIframe && mapIframe.contentWindow) {
                    mapIframe.contentWindow.postMessage({ type: 'DRONE_LIVE_POS', lat: data.lat, lon: data.lon }, '*');
                }
            }
        } catch (e) {
            // Ignora messaggi non-JSON (es. log formattati HTML)
        }
    }

    // --- GESTIONE FLUSSO STREAMING VIDEO HTTP MJPEG ---
    function connectHttpStream(customUrl = null) {
        const inputEl = document.getElementById('mjpeg_url');
        const urlInput = customUrl || (inputEl ? inputEl.value.trim() : '');
        const videoImg = document.getElementById('live-video');
        const offlineText = document.getElementById('offline-text');

        if (!urlInput) {
            alert("Inserisci un indirizzo HTTP valido per lo stream MJPEG (es: http://192.168.1.50:8080/video)");
            return;
        }

        if (videoImg) {
            isHttpStreamMode = true;

            // Gestione caricamento positivo dello stream
            videoImg.onload = () => {
                isStreamingActive = true;
                if (offlineText) offlineText.style.display = 'none';
            };

            // Gestione errori di rete o URL invalido
            videoImg.onerror = () => {
                isStreamingActive = false;
                videoImg.style.display = 'none';
                if (offlineText) {
                    offlineText.textContent = 'ERRORE CONNETTIVITÀ STREAM VIDEO HTTP';
                    offlineText.style.display = 'block';
                }
                log('<span style="color:var(--red)">[VIDEO] Impossibile caricare lo stream HTTP dall\'URL fornito.</span>');
            };

            videoImg.src = urlInput;
            videoImg.style.display = 'block';
            if (offlineText) offlineText.style.display = 'none';

            log(`<span style="color:var(--green)">[VIDEO] Connessione avviata verso lo stream MJPEG: ${urlInput}</span>`);
        }
    }

    // --- GESTIONE FLUSSO VIDEO / FOTO IN CONTINUO (Base64 tramite MQTT/WS) ---
    function displayBase64Photo(base64Data) {
        const videoImg = document.getElementById('live-video');
        const offlineText = document.getElementById('offline-text');

        if (videoImg) {
            isHttpStreamMode = false; // Se arriva Base64, disattiviamo il flag HTTP stream

            const srcUrl = base64Data.startsWith('data:') 
                ? base64Data 
                : "data:image/jpeg;base64," + base64Data;

            videoImg.src = srcUrl;
            videoImg.style.display = 'block';
            
            if (offlineText) {
                offlineText.style.display = 'none';
            }

            if (!isStreamingActive) {
                isStreamingActive = true;
                log('<span style="color:var(--green)">[SYS] Flusso immagini Base64 agganciato ed attivo.</span>');
            }
        }
    }

    function initWebSocket(onReady) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            if (onReady) onReady();
            return;
        }

        ws = new WebSocket('ws://localhost:8000/ws');

        ws.onopen = () => {
            log('<span class="sys">[WS] Channel open to local gateway.</span>', 'sys');
            if (onReady) onReady();
        };

        ws.onmessage = (event) => {
            const msgStr = typeof event.data === 'string' ? event.data : '';

            // 1. INTERCETTAZIONE FOTO / STREAMING VIDEO BASE64
            try {
                const data = JSON.parse(msgStr);
                
                // Estrae la stringa immagine da qualsiasi chiave standard
                const framePayload = data.data || data.photo_base64 || data.image;

                if (framePayload && typeof framePayload === 'string' && framePayload.length > 500) {
                    displayBase64Photo(framePayload);
                    return; // Interrompe per non mostrare il Base64 gigante nel log
                }
            } catch(e) {
                // Non è un JSON o non contiene dati immagine
            }

            // 2. GESTIONE LOG E HUD
            if (!msgStr.includes('"alt"') && !msgStr.includes('"bat"') && !msgStr.includes('ALT:')) {
                log(msgStr);
            }

            if (msgStr.includes('[SYSTEM] Connected!')) setStatus(true);
            if (msgStr.includes('[ERROR]') || msgStr.includes('[CRITICAL ERROR]')) setStatus(false);
            
            updateHUDFromTelemetry(msgStr);
        };

        ws.onclose = () => {
            log('<span style="color:var(--red)">[WS] WebSocket connection closed.</span>');
            setStatus(false);
            ws = null;
        };

        ws.onerror = () => {
            log('<span style="color:var(--red)">[WS] Unable to reach the gateway (localhost:8000).</span>');
        };
    }

    function send(obj) {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            alert('Connection not active. Go to the Connection page and reconnect.');
            return false;
        }
        ws.send(JSON.stringify(obj));
        return true;
    }

    function connect(params) {
        sessionStorage.setItem('gcs_conn', JSON.stringify(params));
        const doSend = () => send({
            action: 'connect',
            broker: params.broker,
            connection_type: params.connection_type,
            username: params.username,
            password: params.password,
            topic: params.topic
        });

        if (!ws || ws.readyState !== WebSocket.OPEN) {
            initWebSocket(doSend);
        } else {
            doSend();
        }
    }

    function sendDroneCommand(actionName, paramsObject = null) {
        const dronePayload = { action: actionName };
        if (paramsObject) {
            Object.assign(dronePayload, paramsObject);
        }
        return send({ 
            action: 'command', 
            target_topic: 'drone/commands', 
            payload: JSON.stringify(dronePayload) 
        });
    }

    function quickSwitchProfile(value) {
        const fields = {
            local: { broker: 'localhost', connection_type: 'standard', username: 'admin', password: '160304' },
            cloud: { broker: 'e0d996a0720a4a25ae1a34becc9e8a90.s1.eu.hivemq.cloud', connection_type: 'secure', username: 'univr-studenti', password: 'MQTT-esercitazione2026' }
        };
        const f = fields[value];
        if (!f) return;
        ['broker','connection_type','username','password'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = f[id];
        });
    }

    function toggleTelemetry() {
        const d = document.getElementById('telemetry-drawer');
        if (!d) return;
        d.classList.toggle('open');
    }

    function updateDynamicSubscription() {
        const t = document.getElementById('dynamic_topic');
        if (!t || !t.value) return;
        const raw = sessionStorage.getItem('gcs_conn');
        const params = raw ? JSON.parse(raw) : {};
        send({ action: 'connect', ...params, topic: t.value });
        log(`<span style="color:var(--amber)">[SYS] Topic changed → ${t.value}</span>`);
    }

    function init(opts = {}) {
        terminal = document.getElementById('terminal');
        const online = sessionStorage.getItem('gcs_online') === '1';
        setStatus(online);
        
        if (opts.autoReconnect) {
            const raw = sessionStorage.getItem('gcs_conn');
            if (raw) {
                const params = JSON.parse(raw);
                initWebSocket(() => {
                    setTimeout(() => send({ action: 'connect', ...params }), 300);
                });
            }
        }
    }

    return { 
        init, connect, send, sendDroneCommand, 
        toggleTelemetry, updateDynamicSubscription, quickSwitchProfile, clearTerminal, log,
        connectHttpStream
    };
})();

/* ============================================================
   PAGE LOGIC E COMANDI GLOBALI
   ============================================================ */

function switchTab(tabId, event) {
    if (event) event.preventDefault(); 
    
    document.querySelectorAll('.page-inner').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tabs a').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if (event) event.currentTarget.classList.add('active');
}

document.addEventListener("DOMContentLoaded", () => {
    GCS.init({ autoReconnect: true });
});

function doConnect() {
    const params = {
        broker:          document.getElementById('broker').value,
        connection_type: document.getElementById('connection_type').value,
        username:        document.getElementById('username').value,
        password:        document.getElementById('password').value,
        topic:           document.getElementById('topic').value
    };
    document.getElementById('telemetry-drawer').classList.add('open');
    GCS.connect(params);
}

function connectHttpStream(url) {
    GCS.connectHttpStream(url);
}

function cmd(command) { 
    GCS.sendDroneCommand(command); 
}

function manual(direction) {
    const time  = parseFloat(document.getElementById('cmd_time').value);
    const power = parseFloat(document.getElementById('cmd_power').value);
    let act = direction === 'backward' ? 'backwards' : direction;
    
    GCS.sendDroneCommand(act, { duration: time, speed: power });
}

function sendWaypoint() {
    const lat = parseFloat(document.getElementById('wp_lat').value);
    const lon = parseFloat(document.getElementById('wp_lon').value);
    const alt = parseFloat(document.getElementById('wp_alt').value);
    
    if (isNaN(lat) || isNaN(lon) || isNaN(alt)) { 
        alert('Please enter valid numerical lat, lon, and altitude.'); 
        return; 
    }
    
    GCS.sendDroneCommand("goto", { lat: lat, lon: lon, alt: alt });
}

function takePhoto() {
    GCS.sendDroneCommand("photo");
    GCS.log('<span style="color:var(--amber)">[SYS] Comando foto inviato al drone reale. In attesa del payload Base64...</span>');

    const feed = document.getElementById('video-feed');
    if (feed) {
        feed.style.filter = 'brightness(3)';
        setTimeout(() => feed.style.filter = '', 120);
    }
}