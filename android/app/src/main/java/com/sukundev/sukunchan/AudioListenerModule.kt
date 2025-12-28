package com.sukundev.sukunchan

import android.app.Activity
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.sqrt

class AudioListenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private var recordingThread: Thread? = null
    private val handler = Handler(Looper.getMainLooper())

    // MediaProjection
    private var mediaProjectionManager: MediaProjectionManager? = null
    private var mediaProjection: MediaProjection? = null
    private var mediaProjectionPermissionPromise: Promise? = null

    // Foreground Service
    private var mediaProjectionService: MediaProjectionService? = null
    private var serviceBound = false

    // Audio configuration - MONO untuk compatibility yang lebih baik
    private val sampleRate = 44100
    private val channelConfig = AudioFormat.CHANNEL_IN_MONO
    private val audioFormat = AudioFormat.ENCODING_PCM_16BIT
    private val bufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat) * 4

    // Metrics
    private var currentAmplitude = 0.0
    private var currentPeak = 0.0
    private var currentRms = 0.0

    // Pending permission data
    private var pendingResultCode: Int? = null
    private var pendingData: Intent? = null

    companion object {
        private const val MEDIA_PROJECTION_REQUEST_CODE = 1002
    }

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
            val binder = service as? MediaProjectionService.LocalBinder
            mediaProjectionService = binder?.getService()
            serviceBound = true

            pendingResultCode?.let { resultCode ->
                pendingData?.let { data ->
                    processMediaProjectionPermission(resultCode, data)
                    pendingResultCode = null
                    pendingData = null
                }
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            mediaProjectionService = null
            serviceBound = false
        }
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "AudioListener"

    @ReactMethod
    fun isAvailable(promise: Promise) {
        val available = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        promise.resolve(available)
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.reject("ERROR", "Audio capture requires Android 10 or higher")
            return
        }

        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("ERROR", "Activity not available")
            return
        }

        try {
            mediaProjectionManager = activity.getSystemService(Context.MEDIA_PROJECTION_SERVICE) 
                as MediaProjectionManager

            val intent = mediaProjectionManager?.createScreenCaptureIntent()
            if (intent == null) {
                promise.reject("ERROR", "Failed to create screen capture intent")
                return
            }

            mediaProjectionPermissionPromise = promise
            activity.startActivityForResult(intent, MEDIA_PROJECTION_REQUEST_CODE)

        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to request permission: ${e.message}")
        }
    }

    @ReactMethod
    fun checkPermission(promise: Promise) {
        val hasPermission = mediaProjection != null
        promise.resolve(hasPermission)
    }

    @RequiresApi(Build.VERSION_CODES.Q)
    @ReactMethod
    fun start(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            promise.reject("ERROR", "Audio capture requires Android 10 or higher")
            return
        }

        if (isRecording) {
            promise.reject("ERROR", "Audio listener already running")
            return
        }

        // Check if we need to request permission again
        if (mediaProjection == null) {
            promise.reject("PERMISSION_DENIED", "MediaProjection permission not granted. Call requestPermission() first.")
            return
        }

        try {
            val captureConfig = AudioPlaybackCaptureConfiguration.Builder(mediaProjection!!)
                .excludeUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION)
                .excludeUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION_SIGNALLING)
                .excludeUsage(android.media.AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                .build()

            val audioFormatConfig = AudioFormat.Builder()
                .setEncoding(audioFormat)
                .setSampleRate(sampleRate)
                .setChannelMask(channelConfig)
                .build()

            audioRecord = AudioRecord.Builder()
                .setAudioFormat(audioFormatConfig)
                .setBufferSizeInBytes(bufferSize)
                .setAudioPlaybackCaptureConfig(captureConfig)
                .build()

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                val state = audioRecord?.state
                promise.reject("ERROR", "Failed to initialize AudioRecord (state: $state)")
                return
            }

            audioRecord?.startRecording()
            isRecording = true

            recordingThread = Thread { recordingLoop() }
            recordingThread?.start()

            promise.resolve("Audio listener started")

        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to start audio listener: ${e.message}")
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        if (!isRecording) {
            promise.resolve("Audio listener not running")
            return
        }

        try {
            isRecording = false
            recordingThread?.join(1000)
            recordingThread = null
            
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
            
            // Release MediaProjection to save battery
            mediaProjection?.stop()
            mediaProjection = null

            // Unbind and stop service
            if (serviceBound) {
                reactApplicationContext.unbindService(serviceConnection)
                serviceBound = false
            }

            val serviceIntent = Intent(reactApplicationContext, MediaProjectionService::class.java)
            reactApplicationContext.stopService(serviceIntent)
            
            promise.resolve("Audio listener stopped")
            
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to stop audio listener: ${e.message}")
        }
    }

    @ReactMethod
    fun releaseProjection(promise: Promise) {
        try {
            mediaProjection?.stop()
            mediaProjection = null

            if (serviceBound) {
                reactApplicationContext.unbindService(serviceConnection)
                serviceBound = false
            }

            val serviceIntent = Intent(reactApplicationContext, MediaProjectionService::class.java)
            reactApplicationContext.stopService(serviceIntent)

            promise.resolve("MediaProjection released")
            
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to release projection: ${e.message}")
        }
    }

    @ReactMethod
    fun getMetrics(promise: Promise) {
        val metrics = Arguments.createMap().apply {
            putDouble("amplitude", roundTo3Decimals(currentAmplitude))
            putDouble("peak", roundTo3Decimals(currentPeak))
            putDouble("rms", roundTo3Decimals(currentRms))
            putBoolean("isSilent", currentRms < 0.01)
        }
        promise.resolve(metrics)
    }

    @ReactMethod
    fun getActiveAudioSessions(promise: Promise) {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) 
                as android.media.AudioManager
            
            val result = Arguments.createMap().apply {
                putBoolean("isMusicActive", audioManager.isMusicActive)
                putInt("mode", audioManager.mode)
                putBoolean("isRecording", isRecording)
                putBoolean("hasMediaProjection", mediaProjection != null)
            }
            
            promise.resolve(result)
            
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun recordingLoop() {
        val buffer = ShortArray(bufferSize / 2)

        while (isRecording) {
            try {
                val readSize = audioRecord?.read(buffer, 0, buffer.size) ?: 0

                if (readSize > 0) {
                    calculateMetrics(buffer, readSize)
                    sendAudioMetrics()
                }

            } catch (e: Exception) {
                // Silent error handling
            }
        }
    }

    @ReactMethod
    fun debugAudioState(promise: Promise) {
        try {
            val audioManager = reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) 
                as android.media.AudioManager
            
            val result = Arguments.createMap().apply {
                putBoolean("isMusicActive", audioManager.isMusicActive)
                putBoolean("isRecording", isRecording)
                putBoolean("hasMediaProjection", mediaProjection != null)
                putBoolean("hasAudioRecord", audioRecord != null)
                
                audioRecord?.let {
                    putInt("audioRecordState", it.state)
                    putInt("recordingState", it.recordingState)
                    putInt("sampleRate", it.sampleRate)
                    putInt("audioFormat", it.audioFormat)
                    putInt("channelCount", it.channelCount)
                }
                
                putInt("musicVolume", audioManager.getStreamVolume(android.media.AudioManager.STREAM_MUSIC))
                putInt("musicMaxVolume", audioManager.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC))
                
                putDouble("currentRms", currentRms)
                putDouble("currentPeak", currentPeak)
                putDouble("currentAmplitude", currentAmplitude)
            }
            
            promise.resolve(result)
            
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun calculateMetrics(buffer: ShortArray, size: Int) {
        if (size == 0) {
            currentAmplitude = 0.0
            currentPeak = 0.0
            currentRms = 0.0
            return
        }

        var sum = 0.0
        var sumSquares = 0.0
        var max = 0

        for (i in 0 until size) {
            val value = kotlin.math.abs(buffer[i].toInt())
            sum += value
            sumSquares += value * value
            if (value > max) {
                max = value
            }
        }

        val maxInt16 = 32768.0
        currentAmplitude = (sum / size) / maxInt16
        currentPeak = max / maxInt16
        currentRms = sqrt(sumSquares / size) / maxInt16
    }

    private fun sendAudioMetrics() {
        val metrics = Arguments.createMap().apply {
            putDouble("amplitude", roundTo3Decimals(currentAmplitude))
            putDouble("peak", roundTo3Decimals(currentPeak))
            putDouble("rms", roundTo3Decimals(currentRms))
            putBoolean("isSilent", currentRms < 0.01)
            putDouble("timestamp", System.currentTimeMillis().toDouble())
        }
        sendEvent("onAudioData", metrics)
    }

    private fun roundTo3Decimals(value: Double): Double {
        return kotlin.math.round(value * 1000) / 1000
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?
    ) {
        if (requestCode == MEDIA_PROJECTION_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                startForegroundService(resultCode, data)
            } else {
                mediaProjectionPermissionPromise?.resolve(false)
                mediaProjectionPermissionPromise = null
            }
        }
    }

    private fun startForegroundService(resultCode: Int, data: Intent) {
        try {
            val serviceIntent = Intent(reactApplicationContext, MediaProjectionService::class.java)
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(serviceIntent)
            } else {
                reactApplicationContext.startService(serviceIntent)
            }

            reactApplicationContext.bindService(
                serviceIntent,
                serviceConnection,
                Context.BIND_AUTO_CREATE
            )

            pendingResultCode = resultCode
            pendingData = data

        } catch (e: Exception) {
            mediaProjectionPermissionPromise?.reject("ERROR", "Failed to start foreground service: ${e.message}")
            mediaProjectionPermissionPromise = null
        }
    }

    private fun processMediaProjectionPermission(resultCode: Int, data: Intent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, data)
                
                if (mediaProjection != null) {
                    mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                        override fun onStop() {
                            super.onStop()
                            sendEvent("onProjectionStopped", Arguments.createMap())
                        }
                    }, handler)
                    
                    mediaProjectionPermissionPromise?.resolve(true)
                } else {
                    mediaProjectionPermissionPromise?.reject("ERROR", "Failed to create MediaProjection")
                }
            } else {
                mediaProjectionPermissionPromise?.reject("ERROR", "Android 10+ required")
            }
            
        } catch (e: Exception) {
            mediaProjectionPermissionPromise?.reject("ERROR", "Failed to get media projection: ${e.message}")
        } finally {
            mediaProjectionPermissionPromise = null
        }
    }

    override fun onNewIntent(intent: Intent) {
        // Not used for this module
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        
        if (isRecording) {
            isRecording = false
            recordingThread?.join(1000)
            audioRecord?.stop()
            audioRecord?.release()
        }
        
        mediaProjection?.stop()
        mediaProjection = null

        if (serviceBound) {
            try {
                reactApplicationContext.unbindService(serviceConnection)
            } catch (e: Exception) {
                // Silent error handling
            }
            serviceBound = false
        }
    }
}