// file general per della applicazione android per il drone
package dji.sampleV5.aircraft.tests

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ImageFormat
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.YuvImage
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.text.format.Formatter
import android.util.Base64

import dji.sampleV5.aircraft.models.BasicAircraftControlVM
import dji.sampleV5.aircraft.models.SimulatorVM
import dji.sampleV5.aircraft.models.VirtualStickVM
import dji.sdk.keyvalue.key.FlightControllerKey
import dji.sdk.keyvalue.key.KeyTools
import dji.v5.manager.KeyManager

import dji.sampleV5.aircraft.tests.camera.CameraGimbalController
import dji.sampleV5.aircraft.tests.config.MqttConfig
import dji.sampleV5.aircraft.tests.control.VirtualFlightController
import dji.sampleV5.aircraft.tests.navigation.WayPointNavigation
import dji.sampleV5.aircraft.tests.network.MjpegServer
import dji.sampleV5.aircraft.tests.network.MqttPublisher
import dji.sampleV5.aircraft.tests.network.MqttSubscriber
import dji.sdk.keyvalue.value.common.ComponentIndexType
import dji.sdk.keyvalue.value.common.LocationCoordinate3D

import dji.v5.common.callback.CommonCallbacks
import dji.v5.common.error.IDJIError
import dji.v5.manager.datacenter.MediaDataCenter
import dji.v5.manager.interfaces.ICameraStreamManager

import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

//mosquitto -c ~/mosquitto.conf
//nano ~/mosquitto.conf
//  listener 1883 0.0.0.0
//  allow_anonymous true

/**
 * Central controller used for automated drone testing and remote control.
 *
 * Responsibilities:
 * - Manage MQTT communication with a remote PC
 * - Periodically publish drone telemetry (location and attitude)
 * - Receive remote commands and translate them into drone actions
 * - Control drone movement using Virtual Stick
 * - Capture camera frames and send them via MQTT or HTTP MJPEG Stream
 * - Control gimbal orientation and zoom
 * - Provide mock video feed for offline / simulator testing
 *
 * The class acts as a bridge between:
 * - DJI SDK flight and camera APIs
 * - An MQTT-based remote control protocol
 * - An optional HTTP MJPEG video stream server
 *
 * Communication Model:
 * PC  <--MQTT-->  Drone
 * PC  <--HTTP-->  Drone (Optional Video Feed)
 *
 * Incoming commands are received through MQTT and handled in [handleRemoteCommand].
 * Telemetry is periodically published using [telemetryTask].
 *
 * @param basicAircraftControlVM DJI view model for aircraft basic controls
 * @param virtualStickVM DJI view model for virtual stick control
 * @param simulatorVM simulator interface used for testing
 * @param context Android context used for accessing media and system services
 * @param onDebug callback used to output debug messages
 * @param isMockMode set to true to enable simulated video feed without a real drone camera
 * @param enableHttpStream set to true to start the local HTTP MJPEG streaming server (port 8080)
 */
class General(
    private val basicAircraftControlVM: BasicAircraftControlVM,
    private val virtualStickVM: VirtualStickVM,
    private val simulatorVM: SimulatorVM,
    private val context: Context,
    private val isMockMode: Boolean = false,
    private val enableHttpStream: Boolean = true,
    private val onDebug: (String) -> Unit
) {

    private var mqttPublisher: MqttPublisher? = null
    private var mqttSubscriber: MqttSubscriber? = null
    private var mjpegServer: MjpegServer? = null

    private val handler = Handler(Looper.getMainLooper())
    private var running = false
    private var isMockingVideo = false

    private val cameraIndex = ComponentIndexType.LEFT_OR_MAIN
    private val captureNextFrame = AtomicBoolean(false)
    private var lastStreamFrameTime = 0L

    private val cameraStreamManager: ICameraStreamManager by lazy {
        MediaDataCenter.getInstance().cameraStreamManager
    }

    /**
     * Starts the telemetry and remote control system.
     *
     * Actions performed:
     * - Establish MQTT connection (Publisher & Subscriber)
     * - Optionally start HTTP MJPEG server
     * - Start the telemetry publishing loop
     * - Subscribe to remote commands
     * - Start camera frame listener OR mock video feed based on configuration
     *
     * If the system is already running, the method exits without restarting it.
     */
    fun startTelemetryTest() {
        if (running) return

        debug("Starting services for ${MqttConfig.HOST}...")

        // Connect to Publisher
        try {
            mqttPublisher = MqttPublisher()
            mqttPublisher?.connect()
        } catch (e: Exception) {
            debug("Publisher issue: ${e.message}")
        }

        // Connect HTTP MJPEG Server if enabled
        if (enableHttpStream) {
            try {
                mjpegServer = MjpegServer(8080) { msg -> debug("[HTTP] $msg") }
                mjpegServer?.start()

                val ip = getLocalIpAddress()
                debug("HTTP VIDEO STREAM READY AT: http://$ip:8080/video")
            } catch (e: Exception) {
                debug("HTTP Server Error: ${e.message}")
            }
        }

        // Connect to Subscriber
        try {
            mqttSubscriber = MqttSubscriber(
                onCommand = { payload ->
                    handleRemoteCommand(payload)
                },
                onDebug = { msg -> debug(msg) }
            )

            mqttSubscriber?.connect()
            running = true
            setFlightLimit()

            telemetryTask.run()

            if (isMockMode) {
                startMockVideoFeed()
            } else {
                startCameraFrameListener()
            }

            debug("Test started successfully")
        } catch (e: Exception) {
            debug("Subscriber critical error: ${e.message}")
        }
    }

    /**
     * Stops the telemetry system and closes connections.
     *
     * This will:
     * - Stop telemetry publishing
     * - Remove scheduled tasks
     * - Disconnect MQTT publisher & subscriber
     * - Stop HTTP MJPEG server
     * - Stop mock video generator
     */
    fun stopTelemetryTest() {
        if (!running) return

        running = false
        isMockingVideo = false
        handler.removeCallbacks(telemetryTask)
        mqttPublisher?.disconnect()
        mqttSubscriber?.disconnect()
        mjpegServer?.stop()
        debug("Test stopped")
    }

    /**
     * Periodic telemetry publisher.
     *
     * Every 200 ms it reads:
     * - aircraft location
     * - aircraft attitude
     *
     * and sends them to the MQTT broker using [mqttPublisher].
     */
    private val telemetryTask = object : Runnable {
        override fun run() {
            if (!running) return

            try {
                val locationKey = KeyTools.createKey(FlightControllerKey.KeyAircraftLocation3D)
                val attitudeKey = KeyTools.createKey(FlightControllerKey.KeyAircraftAttitude)

                val location = KeyManager.getInstance().getValue(locationKey)
                val attitude = KeyManager.getInstance().getValue(attitudeKey)

                if (location != null && attitude != null) {
                    mqttPublisher?.publishTelemetry(location, attitude)
                }
            } catch (e: Exception) {
                debug("Error telemetry: ${e.message}")
            }

            handler.postDelayed(this, 200)
        }
    }

    /**
     * Controller for virtual stick movements.
     * Handles the conversion of high-level commands (e.g., "forward") into
     * precise roll, pitch, yaw, and vertical throttle values sent to the drone.
     */
    private val vfc = VirtualFlightController(
        basicAircraftControlVM,
        virtualStickVM,
        simulatorVM,
        deadZone = 0.0005f,
        onDebug = { msg -> debug(msg) }
    )

    /**
     * Waypoint navigation controller.
     * Handles latitude, longitude, and altitude input and translates this data into
     * commands to navigate the drone to the target waypoint.
     */
    private val wpn = WayPointNavigation(
        vfc = vfc,
        onDebug = { msg -> debug(msg) }
    )

    private val gimbalController = CameraGimbalController { msg -> debug(msg) }

    /**
     * Generates a simulated video feed displaying a dark blue background with current timestamp.
     * Useful for testing video streaming and UI response without connecting a real drone camera.
     */
    private fun startMockVideoFeed() {
        if (isMockingVideo) return
        isMockingVideo = true

        Thread {
            while (isMockingVideo && running) {
                try {
                    val width = 640
                    val height = 480
                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)

                    canvas.drawColor(Color.rgb(20, 40, 70))

                    val paint = Paint().apply {
                        color = Color.WHITE
                        textSize = 40f
                        textAlign = Paint.Align.CENTER
                    }
                    val timeString = SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault()).format(Date())
                    canvas.drawText("MOCK DRONE FEED - NO DRONE", width / 2f, height / 2f - 30f, paint)
                    canvas.drawText(timeString, width / 2f, height / 2f + 30f, paint)

                    val outputStream = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 60, outputStream)
                    val jpegData = outputStream.toByteArray()

                    mjpegServer?.updateFrame(jpegData)

                    if (captureNextFrame.getAndSet(false)) {
                        mqttPublisher?.publishPhoto(jpegData)
                        debug("Mock photo single shot sent via MQTT")
                    }

                    Thread.sleep(100)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }.start()
    }

    /**
     * Starts a camera frame listener using DJI CameraStreamManager.
     *
     * Frames are monitored in YUV format.
     * - If HTTP streaming is enabled, frames are processed continuously (~20 FPS) and sent to the HTTP server.
     * - If a photo is requested via MQTT ([captureNextFrame]), the frame is compressed to JPEG and published via MQTT.
     * - If HTTP streaming is disabled and no photo is requested, incoming frames are skipped to preserve CPU.
     */
    private fun startCameraFrameListener() {
        cameraStreamManager.addFrameListener(
            cameraIndex,
            ICameraStreamManager.FrameFormat.YUV420_888
        ) { data, width, height, _, _, _ ->

            if (!running || data == null || data.isEmpty()) return@addFrameListener

            val isPhotoRequested = captureNextFrame.getAndSet(false)

            // If HTTP stream is OFF and no photo was requested, skip processing to save CPU
            if (!enableHttpStream && !isPhotoRequested) return@addFrameListener

            val now = System.currentTimeMillis()

            // Limit video stream conversion rate to ~20 FPS (every 50ms) to reduce CPU load when streaming HTTP
            if (enableHttpStream && !isPhotoRequested && (now - lastStreamFrameTime < 50)) {
                return@addFrameListener
            }
            lastStreamFrameTime = now

            var realWidth = width
            var realHeight = height

            if (realWidth <= 0 || realHeight <= 0) {
                when (data.size) {
                    1382400 -> { realWidth = 1280; realHeight = 720 }
                    3110400 -> { realWidth = 1920; realHeight = 1080 }
                    else -> return@addFrameListener
                }
            }

            // Perform compression and network transmission in a background thread
            // to prevent stuttering in the drone's video feed.
            Thread {
                try {
                    val jpeg = convertYuvToJpeg(data, realWidth, realHeight)
                    if (jpeg != null) {
                        // 1. Update continuous HTTP MJPEG stream if enabled
                        if (enableHttpStream) {
                            mjpegServer?.updateFrame(jpeg)
                        }

                        // 2. Publish single photo via MQTT if requested
                        if (isPhotoRequested) {
                            mqttPublisher?.publishPhoto(jpeg)
                            debug("Photo sent via MQTT - Resolution: ${realWidth}x${realHeight}")
                        }
                    } else {
                        if (isPhotoRequested) {
                            debug("Conversion Error: JPEG compression failed")
                        }
                    }
                } catch (e: Exception) {
                    debug("Processing Error: ${e.message}")
                }
            }.start()
        }
    }

    /**
     * Converts raw YUV data from the DJI SDK into a JPEG ByteArray.
     * This method specifically fixes the "purple/green" tint by reordering
     * Planar YUV420 pixels into the Interleaved NV21 format required by Android.
     */
    private fun convertYuvToJpeg(data: ByteArray, width: Int, height: Int): ByteArray? {
        return try {
            val out = ByteArrayOutputStream()
            val frameSize = width * height
            val expectedSize = frameSize * 3 / 2

            val nv21 = ByteArray(expectedSize)

            System.arraycopy(data, 0, nv21, 0, frameSize)

            val uPlane = frameSize
            val vPlane = frameSize + (frameSize / 4)

            for (i in 0 until (frameSize / 4)) {
                nv21[frameSize + i * 2] = data[vPlane + i]
                nv21[frameSize + i * 2 + 1] = data[uPlane + i]
            }

            val yuvImage = YuvImage(
                nv21,
                ImageFormat.NV21,
                width,
                height,
                null
            )

            if (yuvImage.compressToJpeg(Rect(0, 0, width, height), 65, out)) {
                out.toByteArray()
            } else null
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Entry point for all incoming MQTT messages from the "drone/commands" topic.
     *
     * @param payload A JSON string containing:
     * - "action": (String) The command name (e.g., "forward", "gimbal", "photo").
     * - "duration": (Double, optional) Time in milliseconds for movement.
     * - "speed": (Double, optional) Normalized speed between 0.0 and 1.0.
     * - "pitch"/"yaw": (Double, optional) Target angles for gimbal control.
     *
     * Flight control:
     * - enablevs / disablevs
     * - takeoff
     * - land
     * - stop
     * - forward / backwards
     * - left / right
     * - up / down
     * - rotateleft / rotateright
     * - orbit
     * - goto
     *
     * Camera & Gimbal:
     * - photo
     * - zoom
     * - gimbal (pitch, yaw)
     *
     * Diagnostics:
     * - ping
     * - p-photo
     */
    private fun handleRemoteCommand(payload: String) {
        try {
            val json = JSONObject(payload)
            val action = json.optString("action").lowercase()

            val duration = json.optDouble("duration", -1.0)
            val speed = json.optDouble("speed", -1.0)

            when (action) {
                "p-photo" -> {
                    val pcTimestamp = json.optLong("timestamp")
                    val droneReceivedTime = System.currentTimeMillis()
                    executeGalleryPingTest(pcTimestamp, droneReceivedTime)
                }
                "ping" -> {
                    val timestamp = json.optLong("timestamp")
                    sendPing(timestamp)
                }

                //---- DRONE MOVEMENT -----
                "enablevs" -> executeVSEnable()
                "disablevs" -> executeVSDisable()

                "takeoff" -> executeTakeoff()
                "land" -> executeLanding()
                "stop" -> {
                    debug("Remote Command: STOP")
                    vfc.stop()
                }
                "forward" -> {
                    if (duration > 0 && speed > 0 && speed <= 1.0) {
                        debug("Remote Command: FORWARD")
                        vfc.forward(speed.toFloat())
                        handler.postDelayed({ vfc.stop() }, duration.toLong())
                    } else {
                        debug("Invalid forward parameters")
                    }
                }
                "backwards" -> {
                    if (duration > 0 && speed > 0 && speed <= 1.0) {
                        debug("Remote Command: BACKWARD")
                        vfc.backward(speed.toFloat())
                        handler.postDelayed({ vfc.stop() }, duration.toLong())
                    } else {
                        debug("Invalid forward parameters")
                    }
                }
                "right" -> {
                    if (duration > 0 && speed > 0 && speed <= 1.0) {
                        debug("Remote Command: ROTATE RIGHT")
                        vfc.right(speed.toFloat())
                        handler.postDelayed({ vfc.stop() }, duration.toLong())
                    } else {
                        debug("Invalid forward parameters")
                    }
                }
                "left" -> {
                    if (duration > 0 && speed > 0 && speed <= 1.0) {
                        debug("Remote Command: ROTATE LEFT")
                        vfc.left(speed.toFloat())
                        handler.postDelayed({ vfc.stop() }, duration.toLong())
                    } else {
                        debug("Invalid forward parameters")
                    }
                }
                "rotateright" -> {
                    if (duration > 0 && speed > 0 && speed <= 1.0) {
                        debug("Remote Command: ROTATE RIGHT")
                        vfc.rotateRight(speed.toFloat())
                        handler.postDelayed({ vfc.stop() }, duration.toLong())
                    } else {
                        debug("Invalid forward parameters")
                    }
                }
                "rotateleft" -> {
                    if (duration > 0 && speed > 0 && speed <= 1.0) {
                        debug("Remote Command: ROTATE LEFT")
                        vfc.rotateLeft(speed.toFloat())
                        handler.postDelayed({ vfc.stop() }, duration.toLong())
                    } else {
                        debug("Invalid forward parameters")
                    }
                }
                "up" -> {
                    if (duration > 0 && speed > 0 && speed <= 1.0) {
                        debug("Remote Command: UP")
                        vfc.up(speed.toFloat())
                        handler.postDelayed({ vfc.stop() }, duration.toLong())
                    } else {
                        debug("Invalid forward parameters")
                    }
                }
                "down" -> {
                    if (duration > 0 && speed > 0 && speed <= 1.0) {
                        debug("Remote Command: DOWN")
                        vfc.down(speed.toFloat())
                        handler.postDelayed({ vfc.stop() }, duration.toLong())
                    } else {
                        debug("Invalid forward parameters")
                    }
                }
                "orbit" -> {
                    if (duration > 0) {
                        debug("Remote Command: Start Orbit")
                        vfc.right(0.2f)
                        vfc.rotateLeft(0.15f)
                        handler.postDelayed({
                            vfc.stop()
                            debug("Movement completed")
                        }, duration.toLong())
                    }
                }

                // WAYPOINT NAVIGATION
                "goto" -> {
                    val lat = json.optDouble("lat")
                    val lon = json.optDouble("lon")
                    val alt = json.optDouble("alt")
                    debug("Remote Command: GOTO $lat $lon $alt")
                    wpn.gotogps(lat, lon, alt)
                }

                //---- CAMERA & GIMBAL -----
                "gimbal" -> {
                    val pitch = json.optDouble("pitch", 0.0)
                    val yaw = json.optDouble("yaw", 0.0)
                    debug("Remote Command: GIMBAL P:$pitch Y:$yaw")
                    gimbalController.rotateTo(pitch = pitch, yaw = yaw)
                }
                "zoom" -> {
                    val zoom = json.optDouble("value", 1.0)
                    debug("Remote Command: ZOOM $zoom")
                    gimbalController.setZoom(zoom)
                }
                "photo" -> executeTakePhoto()

                else -> debug("Unknown action: $action")
            }
        } catch (e: Exception) {
            debug("Error parsing command: ${e.message}")
        }
    }

    /**
     * Sends a ping response back to the PC to measure communication latency.
     *
     * The response includes:
     * - original PC timestamp
     * - time when the drone received the message
     */
    private fun sendPing(originalTimestamp: Long) {
        val response = JSONObject().apply {
            put("action", "ping")
            put("timestamp", originalTimestamp)
            put("drone_received_at", System.currentTimeMillis())
        }
        mqttPublisher?.publish("drone/ping", response.toString())
    }

    /**
     * Execute takeoff + Enable Virtual Stick
     */
    private fun executeTakeoff() {
        debug("Remote Command: TAKEOFF")
        vfc.takeOff(
            onOk = { debug("Takeoff successful") },
            onErr = { debug("Takeoff Failed: ${it.description()}") }
        )
    }

    /**
     * Execute landing
     */
    private fun executeLanding() {
        debug("Remote Command: LAND")
        vfc.land(
            onOk = { debug("Landing successful") },
            onErr = { debug("Landing Failed: ${it.description()}") }
        )
    }

    /**
     * Enable Virtual Stick
     */
    private fun executeVSEnable() {
        debug("Remote Command: ENABLE VS")
        virtualStickVM.enableVirtualStick(object : CommonCallbacks.CompletionCallback {
            override fun onSuccess() {
                debug("VS enabled successfully")
            }
            override fun onFailure(error: IDJIError) {
                debug("Failed to enable VS")
            }
        })
    }

    /**
     * Disable Virtual Stick
     */
    private fun executeVSDisable() {
        debug("Remote Command: DISABLE VS")
        virtualStickVM.disableVirtualStick(object : CommonCallbacks.CompletionCallback {
            override fun onSuccess() {
                debug("VS disabled successfully")
            }
            override fun onFailure(error: IDJIError) {
                debug("Failed to disable")
            }
        })
    }

    /**
     * Triggers a high-speed "Live Stream" photo capture.
     * Sets [captureNextFrame] to true so the next frame will be processed and sent via MQTT.
     */
    private fun executeTakePhoto() {
        debug("Remote Command: PHOTO")
        captureNextFrame.set(true)
    }

    /**
     * Executes an end-to-end latency and data throughput test.
     *
     * This test:
     * 1. Retrieves the most recent high-resolution photo from the drone's local gallery.
     * 2. Resizes the image to 720p to manage MQTT payload size.
     * 3. Calculates processing time on the drone.
     * 4. Bundles the image, GPS coordinates, and timing data into a JSON response
     * sent to "drone/ping_test".
     */
    private fun executeGalleryPingTest(pcTimestamp: Long, droneReceivedTime: Long) {
        val photoBytes = getLastPhotoFromGallery() ?: return
        val takeLoc = getLocation() ?: return

        val originalBitmap = BitmapFactory.decodeByteArray(photoBytes, 0, photoBytes.size)
        val targetWidth = 1280
        val targetHeight = (originalBitmap.height.toFloat() / originalBitmap.width.toFloat() * targetWidth).toInt()
        val resized = Bitmap.createScaledBitmap(originalBitmap, targetWidth, targetHeight, true)

        val out = ByteArrayOutputStream()
        resized.compress(Bitmap.CompressFormat.JPEG, 85, out)
        val finalJpeg = out.toByteArray()

        val droneTotalTime = System.currentTimeMillis() - droneReceivedTime

        val payload = JSONObject().apply {
            put("action", "ping_response")
            put("pc_timestamp", pcTimestamp)
            put("drone_proc_ms", droneTotalTime)
            put("drone_location", takeLoc)
            put("photo_base64", Base64.encodeToString(finalJpeg, Base64.NO_WRAP))
        }

        mqttPublisher?.publish("drone/ping_test", payload.toString())
    }

    private fun getLastPhotoFromGallery(): ByteArray? {
        val projection = arrayOf(MediaStore.Images.Media.DATA)
        val cursor = context.contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            projection,
            null,
            null,
            "${MediaStore.Images.Media.DATE_TAKEN} DESC"
        )

        cursor?.use {
            if (it.moveToFirst()) {
                val path = it.getString(0)
                return File(path).readBytes()
            }
        }
        return null
    }

    private fun getLocation(): LocationCoordinate3D? {
        val locationKey = KeyTools.createKey(FlightControllerKey.KeyAircraftLocation3D)
        return KeyManager.getInstance().getValue(locationKey)
    }

    private fun setFlightLimit() {
        KeyManager.getInstance().setValue(KeyTools.createKey(FlightControllerKey.KeyMaxRadiusCanFlyAndGoHome), 10.0, null)
        KeyManager.getInstance().setValue(KeyTools.createKey(FlightControllerKey.KeyLimitMaxFlightHeightInMeter), 2, null)
    }

    /**
     * Retrieves the local Wi-Fi IP address of the Android device.
     */
    private fun getLocalIpAddress(): String {
        return try {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            Formatter.formatIpAddress(wifiManager.connectionInfo.ipAddress)
        } catch (e: Exception) {
            "127.0.0.1"
        }
    }

    /**
     * Returns whether the telemetry test system is currently active.
     */
    fun isRunning(): Boolean = running

    private fun debug(msg: String) {
        onDebug(msg)
    }
}