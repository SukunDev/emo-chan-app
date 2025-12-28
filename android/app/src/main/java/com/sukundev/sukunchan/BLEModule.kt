package com.sukundev.sukunchan

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.ActivityCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import org.json.JSONArray
import java.util.*
import java.util.concurrent.ConcurrentLinkedQueue

class BLEModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bluetoothLeScanner: BluetoothLeScanner? = null
    private var bluetoothGatt: BluetoothGatt? = null
    private var writeCharacteristic: BluetoothGattCharacteristic? = null
    
    private val handler = Handler(Looper.getMainLooper())
    private val devices = mutableMapOf<String, BluetoothDevice>()
    private var isScanning = false
    
    // Queue untuk mengelola pengiriman data
    private val dataQueue = ConcurrentLinkedQueue<ByteArray>()
    private var isSending = false
    private val sendHandler = Handler(Looper.getMainLooper())
    
    // Konstanta
    companion object {
        private const val MTU_SIZE = 512 // Request MTU maksimal
        private const val CHUNK_SIZE = 500 // Ukuran chunk data (lebih kecil dari MTU)
    }

    init {
        val bluetoothManager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter
        bluetoothLeScanner = bluetoothAdapter?.bluetoothLeScanner
    }

    override fun getName(): String = "BLEModule"

    @ReactMethod
    fun isBluetoothEnabled(promise: Promise) {
        try {
            val enabled = bluetoothAdapter?.isEnabled ?: false
            promise.resolve(enabled)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        try {
            val context = reactApplicationContext
            val hasPermissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                ActivityCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            } else {
                ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            }
            promise.resolve(hasPermissions)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun startScan(promise: Promise) {
        try {
            if (isScanning) {
                promise.reject("ERROR", "Already scanning")
                return
            }

            devices.clear()
            isScanning = true

            val scanSettings = ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build()

            bluetoothLeScanner?.startScan(null, scanSettings, scanCallback)
            
            // Auto stop setelah 10 detik
            handler.postDelayed({
                stopScan()
            }, 10000)

            promise.resolve("Scan started")
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_ERROR", "Missing Bluetooth permissions")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopScan(promise: Promise? = null) {
        try {
            if (isScanning) {
                bluetoothLeScanner?.stopScan(scanCallback)
                isScanning = false
            }
            promise?.resolve("Scan stopped")
        } catch (e: Exception) {
            promise?.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getScannedDevices(promise: Promise) {
        try {
            val deviceList = Arguments.createArray()
            devices.values.forEach { device ->
                val deviceMap = Arguments.createMap().apply {
                    putString("id", device.address)
                    putString("name", device.name ?: "Unknown")
                    putString("address", device.address)
                }
                deviceList.pushMap(deviceMap)
            }
            promise.resolve(deviceList)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun connect(deviceId: String, promise: Promise) {
        try {
            val device = devices[deviceId]
            if (device == null) {
                promise.reject("ERROR", "Device not found")
                return
            }

            if (bluetoothGatt != null) {
                promise.reject("ERROR", "Already connected to a device")
                return
            }

            // Simpan promise untuk callback nanti
            connectPromise = promise

            bluetoothGatt = device.connectGatt(
                reactApplicationContext,
                false,
                gattCallback,
                BluetoothDevice.TRANSPORT_LE
            )
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_ERROR", "Missing Bluetooth permissions")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            bluetoothGatt?.disconnect()
            bluetoothGatt?.close()
            bluetoothGatt = null
            writeCharacteristic = null
            dataQueue.clear()
            isSending = false
            
            promise.resolve("Disconnected")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        promise.resolve(bluetoothGatt != null && writeCharacteristic != null)
    }

    @ReactMethod
    fun sendData(data: String, promise: Promise) {
        try {
            if (bluetoothGatt == null || writeCharacteristic == null) {
                promise.reject("ERROR", "Not connected")
                return
            }

            val bytes = data.toByteArray(Charsets.UTF_8)
            
            // Jika data kecil, kirim langsung
            if (bytes.size <= CHUNK_SIZE) {
                dataQueue.offer(bytes)
            } else {
                // Split data besar menjadi chunks
                var offset = 0
                while (offset < bytes.size) {
                    val end = minOf(offset + CHUNK_SIZE, bytes.size)
                    val chunk = bytes.copyOfRange(offset, end)
                    dataQueue.offer(chunk)
                    offset = end
                }
            }
            
            // Mulai proses pengiriman jika belum berjalan
            if (!isSending) {
                processQueue()
            }
            
            promise.resolve("Data queued")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun sendJson(json: ReadableMap, promise: Promise) {
        try {
            // Konversi ReadableMap ke JSONObject secara native
            val jsonObject = convertReadableMapToJson(json)
            // Dapatkan string JSON tanpa escape tambahan
            val jsonString = jsonObject.toString()
            
            sendData(jsonString, promise)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getQueueSize(promise: Promise) {
        promise.resolve(dataQueue.size)
    }

    private var connectPromise: Promise? = null

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            val device = result.device
            if (!devices.containsKey(device.address)) {
                devices[device.address] = device
                
                val deviceMap = Arguments.createMap().apply {
                    putString("id", device.address)
                    putString("name", device.name ?: "Unknown")
                    putString("address", device.address)
                    putInt("rssi", result.rssi)
                }
                sendEvent("onDeviceFound", deviceMap)
            }
        }

        override fun onScanFailed(errorCode: Int) {
            isScanning = false
            val error = Arguments.createMap().apply {
                putInt("errorCode", errorCode)
                putString("message", "Scan failed with error code: $errorCode")
            }
            sendEvent("onScanError", error)
        }
    }

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
            when (newState) {
                BluetoothProfile.STATE_CONNECTED -> {
                    // Request MTU lebih besar untuk throughput lebih tinggi
                    gatt.requestMtu(MTU_SIZE)
                }
                BluetoothProfile.STATE_DISCONNECTED -> {
                    bluetoothGatt?.close()
                    bluetoothGatt = null
                    writeCharacteristic = null
                    dataQueue.clear()
                    isSending = false
                    
                    connectPromise?.reject("DISCONNECTED", "Device disconnected")
                    connectPromise = null
                    
                    sendEvent("onDisconnected", Arguments.createMap())
                }
            }
        }

        override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                // MTU berhasil diubah, sekarang discover services
                gatt.discoverServices()
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                // Cari characteristic yang writable
                for (service in gatt.services) {
                    for (characteristic in service.characteristics) {
                        val isWritable = (characteristic.properties and 
                            (BluetoothGattCharacteristic.PROPERTY_WRITE or 
                             BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)) != 0
                        
                        if (isWritable) {
                            writeCharacteristic = characteristic
                            
                            // Set write type sesuai dengan property characteristic
                            if ((characteristic.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0) {
                                characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                            } else {
                                characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                            }
                            
                            val deviceMap = Arguments.createMap().apply {
                                putString("id", gatt.device.address)
                                putString("name", gatt.device.name ?: "Unknown")
                                putString("serviceUUID", service.uuid.toString())
                                putString("characteristicUUID", characteristic.uuid.toString())
                            }
                            
                            connectPromise?.resolve(deviceMap)
                            connectPromise = null
                            
                            sendEvent("onConnected", deviceMap)
                            return
                        }
                    }
                }
                
                connectPromise?.reject("ERROR", "No writable characteristic found")
                connectPromise = null
            }
        }

        override fun onCharacteristicWrite(
            gatt: BluetoothGatt,
            characteristic: BluetoothGattCharacteristic,
            status: Int
        ) {
            // Tulis selesai, lanjutkan dengan data berikutnya
            isSending = false
            processQueue()
        }
    }

    private fun processQueue() {
        if (isSending || dataQueue.isEmpty()) {
            return
        }

        val gatt = bluetoothGatt
        val characteristic = writeCharacteristic

        if (gatt == null || characteristic == null) {
            dataQueue.clear()
            return
        }

        val data = dataQueue.poll() ?: return

        isSending = true

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 13+
                gatt.writeCharacteristic(
                    characteristic,
                    data,
                    characteristic.writeType
                )
            } else {
                // Android < 13
                @Suppress("DEPRECATION")
                characteristic.value = data
                @Suppress("DEPRECATION")
                gatt.writeCharacteristic(characteristic)
            }
        } catch (e: Exception) {
            isSending = false
            // Retry dengan delay kecil
            sendHandler.postDelayed({
                processQueue()
            }, 10)
        }
    }

    /**
     * Konversi ReadableMap ke JSONObject tanpa double-escaping
     */
    private fun convertReadableMapToJson(readableMap: ReadableMap): JSONObject {
        val json = JSONObject()
        val iterator = readableMap.keySetIterator()
        
        while (iterator.hasNextKey()) {
            val key = iterator.nextKey()
            when (readableMap.getType(key)) {
                ReadableType.Null -> json.put(key, JSONObject.NULL)
                ReadableType.Boolean -> json.put(key, readableMap.getBoolean(key))
                ReadableType.Number -> json.put(key, readableMap.getDouble(key))
                ReadableType.String -> json.put(key, readableMap.getString(key))
                ReadableType.Map -> {
                    readableMap.getMap(key)?.let {
                        json.put(key, convertReadableMapToJson(it))
                    }
                }
                ReadableType.Array -> {
                    readableMap.getArray(key)?.let {
                        json.put(key, convertReadableArrayToJson(it))
                    }
                }
            }
        }
        
        return json
    }

    /**
     * Konversi ReadableArray ke JSONArray
     */
    private fun convertReadableArrayToJson(readableArray: ReadableArray): JSONArray {
        val array = JSONArray()
        
        for (i in 0 until readableArray.size()) {
            when (readableArray.getType(i)) {
                ReadableType.Null -> array.put(JSONObject.NULL)
                ReadableType.Boolean -> array.put(readableArray.getBoolean(i))
                ReadableType.Number -> array.put(readableArray.getDouble(i))
                ReadableType.String -> array.put(readableArray.getString(i))
                ReadableType.Map -> {
                    readableArray.getMap(i)?.let {
                        array.put(convertReadableMapToJson(it))
                    }
                }
                ReadableType.Array -> {
                    readableArray.getArray(i)?.let {
                        array.put(convertReadableArrayToJson(it))
                    }
                }
            }
        }
        
        return array
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        
        try {
            stopScan()
            bluetoothGatt?.disconnect()
            bluetoothGatt?.close()
            bluetoothGatt = null
            writeCharacteristic = null
            dataQueue.clear()
        } catch (e: Exception) {
            // Silent cleanup
        }
    }
}