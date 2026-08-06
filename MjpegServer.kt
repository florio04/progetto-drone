package dji.sampleV5.aircraft.tests.network

import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.atomic.AtomicReference

/**
 * Server HTTP ultraleggero in puro Kotlin per lo streaming MJPEG.
 * Non richiede librerie esterne o modifiche al file build.gradle.
 */
class MjpegServer(
    private val port: Int = 8080,
    private val onDebug: (String) -> Unit
) {

    private var serverSocket: ServerSocket? = null
    @Volatile private var isRunning = false
    private val latestFrame = AtomicReference<ByteArray?>(null)
    private val activeClients = CopyOnWriteArrayList<Socket>()

    fun start() {
        if (isRunning) return
        isRunning = true
        Thread {
            try {
                serverSocket = ServerSocket(port)
                onDebug("Server MJPEG attivo sulla porta $port")
                while (isRunning) {
                    val socket = serverSocket?.accept() ?: break
                    Thread { handleClient(socket) }.start()
                }
            } catch (e: Exception) {
                if (isRunning) onDebug("Errore Server MJPEG: ${e.message}")
            }
        }.start()
    }

    fun stop() {
        isRunning = false
        try {
            serverSocket?.close()
            activeClients.forEach { try { it.close() } catch (_: Exception) {} }
            activeClients.clear()
        } catch (_: Exception) {}
    }

    fun updateFrame(frame: ByteArray) {
        latestFrame.set(frame)
    }

    private fun handleClient(socket: Socket) {
        activeClients.add(socket)
        try {
            val outputStream = socket.getOutputStream()
            val boundary = "frame"

            // Header HTTP per lo stream continuo MJPEG
            val header = ("HTTP/1.1 200 OK\r\n" +
                    "Access-Control-Allow-Origin: *\r\n" +
                    "Connection: close\r\n" +
                    "Max-Age: 0\r\n" +
                    "Expires: 0\r\n" +
                    "Cache-Control: no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0\r\n" +
                    "Pragma: no-cache\r\n" +
                    "Content-Type: multipart/x-mixed-replace; boundary=--$boundary\r\n\r\n")

            outputStream.write(header.toByteArray())
            outputStream.flush()

            var lastSentFrame: ByteArray? = null

            while (isRunning && !socket.isClosed) {
                val frame = latestFrame.get()
                if (frame != null && frame != lastSentFrame) {
                    lastSentFrame = frame

                    val frameHeader = ("--$boundary\r\n" +
                            "Content-Type: image/jpeg\r\n" +
                            "Content-Length: ${frame.size}\r\n\r\n")

                    outputStream.write(frameHeader.toByteArray())
                    outputStream.write(frame)
                    outputStream.write("\r\n".toByteArray())
                    outputStream.flush()
                }
                Thread.sleep(40) // Limite a ~25 FPS per non saturare la rete
            }
        } catch (_: Exception) {
            // Il client si è disconnesso (es. browser chiuso)
        } finally {
            activeClients.remove(socket)
            try { socket.close() } catch (_: Exception) {}
        }
    }
}