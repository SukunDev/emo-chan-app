package com.sukundev.sukunchan

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.annotation.RequiresApi
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class MediaListenerModule(reactContext: ReactApplicationContext) : 
    ReactContextBaseJavaModule(reactContext) {
    
    private var mediaSessionManager: MediaSessionManager? = null
    private var activeController: MediaController? = null
    private val handler = Handler(Looper.getMainLooper())
    private var periodicUpdateRunnable: Runnable? = null
    
    // Map untuk menyimpan callbacks per controller
    private val controllerCallbacks = mutableMapOf<MediaController, MediaController.Callback>()
    
    private val sessionListener = object : MediaSessionManager.OnActiveSessionsChangedListener {
        override fun onActiveSessionsChanged(controllers: List<MediaController>?) {
            // Unregister callback dari controller lama
            activeController?.let { oldController ->
                controllerCallbacks[oldController]?.let { callback ->
                    oldController.unregisterCallback(callback)
                    controllerCallbacks.remove(oldController)
                }
            }
            
            // Set controller baru dan register callback
            activeController = controllers?.firstOrNull()
            activeController?.let { controller ->
                registerControllerCallback(controller)
                monitorController(controller)
            }
        }
    }

    override fun getName(): String = "MediaListener"

    @ReactMethod
    fun checkPermission(promise: Promise) {
        try {
            val enabledListeners = NotificationManagerCompat.getEnabledListenerPackages(reactApplicationContext)
            val hasPermission = enabledListeners.contains(reactApplicationContext.packageName)
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun openNotificationSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve("Settings opened")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @RequiresApi(Build.VERSION_CODES.LOLLIPOP)
    @ReactMethod
    fun startListening(promise: Promise) {
        try {
            val enabledListeners = NotificationManagerCompat.getEnabledListenerPackages(reactApplicationContext)
            if (!enabledListeners.contains(reactApplicationContext.packageName)) {
                promise.reject("PERMISSION_DENIED", "Missing permission to control media.")
                return
            }

            val context = reactApplicationContext
            mediaSessionManager = context.getSystemService(Context.MEDIA_SESSION_SERVICE) 
                as MediaSessionManager
            
            val componentName = ComponentName(context, 
                MediaNotificationListener::class.java)
            
            mediaSessionManager?.addOnActiveSessionsChangedListener(
                sessionListener, componentName
            )
            
            // Get current sessions and register callbacks
            val controllers = mediaSessionManager?.getActiveSessions(componentName)
            activeController = controllers?.firstOrNull()
            activeController?.let { controller ->
                registerControllerCallback(controller)
                monitorController(controller)
            }
            
            // Start periodic updates (optional fallback, setiap 5 detik)
            startPeriodicUpdates()
            
            promise.resolve("Started listening")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        try {
            // Stop periodic updates
            stopPeriodicUpdates()
            
            // Unregister all callbacks
            activeController?.let { controller ->
                controllerCallbacks[controller]?.let { callback ->
                    controller.unregisterCallback(callback)
                    controllerCallbacks.remove(controller)
                }
            }
            
            mediaSessionManager?.removeOnActiveSessionsChangedListener(sessionListener)
            activeController = null
            
            promise.resolve("Stopped listening")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    /**
     * Register callback untuk mendeteksi perubahan metadata dan playback state
     */
    private fun registerControllerCallback(controller: MediaController) {
        val callback = object : MediaController.Callback() {
            override fun onMetadataChanged(metadata: MediaMetadata?) {
                super.onMetadataChanged(metadata)
                // Metadata berubah (judul lagu, artist, dll)
                monitorController(controller)
            }

            override fun onPlaybackStateChanged(state: PlaybackState?) {
                super.onPlaybackStateChanged(state)
                // Playback state berubah (play, pause, stop, dll)
                monitorController(controller)
            }

            override fun onSessionDestroyed() {
                super.onSessionDestroyed()
                // Session dihancurkan (app ditutup)
                sendEmptyEvent()
            }
        }
        
        controller.registerCallback(callback)
        controllerCallbacks[controller] = callback
    }

    /**
     * Start periodic updates sebagai fallback
     * Untuk memastikan update tetap jalan meski callback tidak dipanggil
     */
    private fun startPeriodicUpdates() {
        periodicUpdateRunnable = object : Runnable {
            override fun run() {
                activeController?.let { controller ->
                    monitorController(controller)
                }
                // Update setiap 1000 ms
                handler.postDelayed(this, 1000)
            }
        }
        handler.post(periodicUpdateRunnable!!)
    }

    /**
     * Stop periodic updates
     */
    private fun stopPeriodicUpdates() {
        periodicUpdateRunnable?.let { runnable ->
            handler.removeCallbacks(runnable)
        }
        periodicUpdateRunnable = null
    }

    /**
     * Monitor controller dan kirim data ke React Native
     */
    private fun monitorController(controller: MediaController) {
        try {
            val metadata = controller.metadata
            val playbackState = controller.playbackState
            
            val data = Arguments.createMap().apply {
                putString("title", metadata?.getString(MediaMetadata.METADATA_KEY_TITLE))
                putString("artist", metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST))
                putString("album", metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM))
                putString("package", controller.packageName)
                putBoolean("isPlaying", playbackState?.state == PlaybackState.STATE_PLAYING)
                putDouble("position", playbackState?.position?.toDouble() ?: 0.0)
                putDouble("duration", metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION)?.toDouble() ?: 0.0)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            
            sendEvent("onMediaUpdate", data)
        } catch (e: Exception) {
            // Handle error silently or send error event
            e.printStackTrace()
        }
    }

    /**
     * Kirim event kosong ketika tidak ada media
     */
    private fun sendEmptyEvent() {
        val data = Arguments.createMap().apply {
            putNull("title")
            putNull("artist")
            putNull("album")
            putNull("package")
            putBoolean("isPlaying", false)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        sendEvent("onMediaUpdate", data)
    }

    /**
     * Send event ke React Native
     */
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
    
    /**
     * Cleanup saat module di-destroy
     */
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopPeriodicUpdates()
        
        // Unregister all callbacks
        controllerCallbacks.forEach { (controller, callback) ->
            controller.unregisterCallback(callback)
        }
        controllerCallbacks.clear()
        
        mediaSessionManager?.removeOnActiveSessionsChangedListener(sessionListener)
    }
}