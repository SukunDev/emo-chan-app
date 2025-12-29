import { useEffect, useState, useCallback, useRef } from 'react';
import { NativeModules, NativeEventEmitter, PermissionsAndroid, Platform } from 'react-native';

const { BLEModule } = NativeModules;

if (!BLEModule) {
  console.error(
    'BLEModule is not available. Make sure you have added BLEPackage to MainApplication.'
  );
}

const bleEmitter = BLEModule ? new NativeEventEmitter(BLEModule) : null;

export interface BLEDevice {
  id: string;
  name: string;
  address: string;
  rssi?: number;
  wasAlreadyConnected?: boolean;
}

export interface ConnectedDeviceInfo {
  id: string;
  name: string;
  serviceUUID: string;
  characteristicUUID: string;
}

export interface NativeBluetoothLowEnergyApi {
  // Permissions
  requestPermissions(): Promise<boolean>;
  isBluetoothEnabled(): Promise<boolean>;

  // Scanning
  startScan(): Promise<void>;
  stopScan(): Promise<void>;
  getScannedDevices(): Promise<BLEDevice[]>;

  // Connection - NEW METHODS
  getExistingConnections(): Promise<BLEDevice[]>;
  reconnectToDevice(deviceAddress: string): Promise<ConnectedDeviceInfo>;
  connect(deviceId: string): Promise<ConnectedDeviceInfo>;
  disconnect(): Promise<void>;
  isConnected(): Promise<boolean>;

  // Data transmission
  sendData(data: string): Promise<void>;
  sendJson(json: Record<string, any>): Promise<void>;
  getQueueSize(): Promise<number>;

  // State
  allDevices: BLEDevice[];
  connectedDevice: ConnectedDeviceInfo | null;
  isScanning: boolean;

  // Callbacks
  onDeviceFound(callback: (device: BLEDevice) => void): void;
  onConnected(callback: (device: ConnectedDeviceInfo) => void): void;
  onDisconnected(callback: () => void): void;
  onExistingConnection(callback: (device: BLEDevice) => void): void;
}

export function useNativeBLE(): NativeBluetoothLowEnergyApi {
  const [allDevices, setAllDevices] = useState<BLEDevice[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<ConnectedDeviceInfo | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const onDeviceFoundCallback = useRef<((device: BLEDevice) => void) | null>(null);
  const onConnectedCallback = useRef<((device: ConnectedDeviceInfo) => void) | null>(null);
  const onDisconnectedCallback = useRef<(() => void) | null>(null);
  const onExistingConnectionCallback = useRef<((device: BLEDevice) => void) | null>(null);

  // Request permissions
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    if (!BLEModule) {
      console.error('BLEModule not available');
      return false;
    }

    try {
      if (Platform.Version >= 31) {
        const results = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        return (
          results['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          results['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          results['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.error('Permission request error:', err);
      return false;
    }
  };

  const isBluetoothEnabled = async (): Promise<boolean> => {
    if (!BLEModule) return false;

    try {
      return await BLEModule.isBluetoothEnabled();
    } catch (error) {
      console.error('Error checking bluetooth:', error);
      return false;
    }
  };

  // NEW: Get existing connections
  const getExistingConnections = async (): Promise<BLEDevice[]> => {
    if (!BLEModule) return [];

    try {
      return await BLEModule.getExistingConnections();
    } catch (error) {
      console.error('Error getting existing connections:', error);
      return [];
    }
  };

  // NEW: Reconnect to a device using its address
  const reconnectToDevice = async (deviceAddress: string): Promise<ConnectedDeviceInfo> => {
    if (!BLEModule) {
      throw new Error('BLEModule not available');
    }

    try {
      const deviceInfo = await BLEModule.reconnectToDevice(deviceAddress);
      setConnectedDevice(deviceInfo);
      return deviceInfo;
    } catch (error) {
      console.error('Error reconnecting:', error);
      throw error;
    }
  };

  // Scanning
  const startScan = async (): Promise<void> => {
    if (!BLEModule) {
      throw new Error('BLEModule not available');
    }

    try {
      setAllDevices([]);
      setIsScanning(true);
      await BLEModule.startScan();
    } catch (error) {
      setIsScanning(false);
      console.error('Error starting scan:', error);
      throw error;
    }
  };

  const stopScan = async (): Promise<void> => {
    if (!BLEModule) return;

    try {
      await BLEModule.stopScan();
      setIsScanning(false);
    } catch (error) {
      console.error('Error stopping scan:', error);
      throw error;
    }
  };

  const getScannedDevices = async (): Promise<BLEDevice[]> => {
    if (!BLEModule) return [];

    try {
      return await BLEModule.getScannedDevices();
    } catch (error) {
      console.error('Error getting devices:', error);
      return [];
    }
  };

  // Connection
  const connect = async (deviceId: string): Promise<ConnectedDeviceInfo> => {
    if (!BLEModule) {
      throw new Error('BLEModule not available');
    }

    try {
      const deviceInfo = await BLEModule.connect(deviceId);
      setConnectedDevice(deviceInfo);
      return deviceInfo;
    } catch (error) {
      console.error('Error connecting:', error);
      throw error;
    }
  };

  const disconnect = async (): Promise<void> => {
    if (!BLEModule) return;

    try {
      await BLEModule.disconnect();
      setConnectedDevice(null);
    } catch (error) {
      console.error('Error disconnecting:', error);
      throw error;
    }
  };

  const isConnected = async (): Promise<boolean> => {
    if (!BLEModule) return false;

    try {
      return await BLEModule.isConnected();
    } catch (error) {
      console.error('Error checking connection:', error);
      return false;
    }
  };

  // Data transmission
  const sendData = async (data: string): Promise<void> => {
    if (!BLEModule) {
      throw new Error('BLEModule not available');
    }

    try {
      await BLEModule.sendData(data);
    } catch (error) {
      console.error('Error sending data:', error);
      throw error;
    }
  };

  const sendJson = async (json: Record<string, any>): Promise<void> => {
    if (!BLEModule) {
      throw new Error('BLEModule not available');
    }

    try {
      await BLEModule.sendJson(json);
    } catch (error) {
      console.error('Error sending JSON:', error);
      throw error;
    }
  };

  const getQueueSize = async (): Promise<number> => {
    if (!BLEModule) return 0;

    try {
      return await BLEModule.getQueueSize();
    } catch (error) {
      console.error('Error getting queue size:', error);
      return 0;
    }
  };

  // Event listeners
  useEffect(() => {
    if (!bleEmitter) {
      console.warn('BLE Event Emitter not available');
      return;
    }

    const deviceFoundSub = bleEmitter.addListener('onDeviceFound', (device: BLEDevice) => {
      setAllDevices((prev) => {
        const exists = prev.some((d) => d.id === device.id);
        if (exists) return prev;
        return [...prev, device];
      });

      if (onDeviceFoundCallback.current) {
        onDeviceFoundCallback.current(device);
      }
    });

    const connectedSub = bleEmitter.addListener('onConnected', (device: ConnectedDeviceInfo) => {
      setConnectedDevice(device);
      setIsScanning(false);

      if (onConnectedCallback.current) {
        onConnectedCallback.current(device);
      }
    });

    const disconnectedSub = bleEmitter.addListener('onDisconnected', () => {
      setConnectedDevice(null);

      if (onDisconnectedCallback.current) {
        onDisconnectedCallback.current();
      }
    });

    const scanErrorSub = bleEmitter.addListener('onScanError', (error: any) => {
      console.error('Scan error:', error);
      setIsScanning(false);
    });

    // NEW: Listen for existing connections
    const existingConnectionSub = bleEmitter.addListener(
      'onExistingConnection',
      (device: BLEDevice) => {
        console.log('Existing connection detected:', device);

        if (onExistingConnectionCallback.current) {
          onExistingConnectionCallback.current(device);
        }
      }
    );

    return () => {
      deviceFoundSub.remove();
      connectedSub.remove();
      disconnectedSub.remove();
      scanErrorSub.remove();
      existingConnectionSub.remove();
    };
  }, []);

  // Callback setters
  const onDeviceFound = useCallback((callback: (device: BLEDevice) => void) => {
    onDeviceFoundCallback.current = callback;
  }, []);

  const onConnected = useCallback((callback: (device: ConnectedDeviceInfo) => void) => {
    onConnectedCallback.current = callback;
  }, []);

  const onDisconnected = useCallback((callback: () => void) => {
    onDisconnectedCallback.current = callback;
  }, []);

  // NEW: Callback for existing connection
  const onExistingConnection = useCallback((callback: (device: BLEDevice) => void) => {
    onExistingConnectionCallback.current = callback;
  }, []);

  return {
    // Methods
    requestPermissions,
    isBluetoothEnabled,
    startScan,
    stopScan,
    getScannedDevices,
    getExistingConnections,
    reconnectToDevice,
    connect,
    disconnect,
    isConnected,
    sendData,
    sendJson,
    getQueueSize,

    // State
    allDevices,
    connectedDevice,
    isScanning,

    // Callbacks
    onDeviceFound,
    onConnected,
    onDisconnected,
    onExistingConnection,
  };
}

export default useNativeBLE;
