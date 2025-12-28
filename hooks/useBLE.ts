/* eslint-disable no-bitwise */
import { useMemo, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleErrorCode, BleManager, Device, Characteristic } from 'react-native-ble-plx';
import * as ExpoDevice from 'expo-device';
import base64 from 'react-native-base64';

interface CachedCharacteristic {
  serviceUUID: string;
  characteristicUUID: string;
  isWritableWithResponse: boolean;
}

export interface BluetoothLowEnergyApi {
  requestPermissions(): Promise<boolean>;
  scanForPeripherals(): void;
  connectToDevice(device: Device): Promise<void>;
  disconnectFromDevice(): Promise<void>;
  sendDataAuto(data: string): Promise<void>;
  sendJson(json: Record<string, any>): Promise<void>;

  connectedDevice: Device | null;
  allDevices: Device[];
  isScanning: boolean;

  onConnected(cb: (device: Device) => void): void;
  onDisconnected(cb: (device: Device | null, error?: BleError) => void): void;
}

function useBLE(): BluetoothLowEnergyApi {
  const bleManager = useMemo(() => new BleManager(), []);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Cache characteristic UUID untuk pengiriman data yang lebih cepat
  const [cachedCharacteristic, setCachedCharacteristic] = useState<CachedCharacteristic | null>(
    null
  );

  const [onConnectedCb, setOnConnectedCb] = useState<((device: Device) => void) | null>(null);

  const [onDisconnectedCb, setOnDisconnectedCb] = useState<
    ((device: Device | null, error?: BleError) => void) | null
  >(null);

  const requestAndroid31Permissions = async () => {
    const scan = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN);
    const connect = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    );
    const location = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );

    return (
      scan === PermissionsAndroid.RESULTS.GRANTED &&
      connect === PermissionsAndroid.RESULTS.GRANTED &&
      location === PermissionsAndroid.RESULTS.GRANTED
    );
  };

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return true;

    if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return requestAndroid31Permissions();
  };

  const isDuplicateDevice = (devices: Device[], next: Device) =>
    devices.some((d) => d.id === next.id);

  const scanForPeripherals = () => {
    setAllDevices([]);
    setIsScanning(true);

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        if (error.errorCode === BleErrorCode.BluetoothPoweredOff) {
          console.log('Bluetooth OFF');
        }
        setIsScanning(false);
        return;
      }

      if (device) {
        setAllDevices((prev) => (isDuplicateDevice(prev, device) ? prev : [...prev, device]));
      }
    });
  };

  const findWritableCharacteristic = async (device: Device) => {
    const services = await device.services();

    for (const service of services) {
      const chars = await service.characteristics();
      for (const char of chars) {
        if (char.isWritableWithResponse || char.isWritableWithoutResponse) {
          return {
            serviceUUID: service.uuid,
            characteristic: char,
          };
        }
      }
    }
    return null;
  };

  const connectToDevice = async (device: Device) => {
    try {
      const connection = await bleManager.connectToDevice(device.id);
      await connection.discoverAllServicesAndCharacteristics();

      bleManager.stopDeviceScan();
      setIsScanning(false);

      // Cari dan simpan characteristic yang writable saat koneksi
      const writable = await findWritableCharacteristic(connection);
      if (writable) {
        setCachedCharacteristic({
          serviceUUID: writable.serviceUUID,
          characteristicUUID: writable.characteristic.uuid,
          isWritableWithResponse: writable.characteristic.isWritableWithResponse,
        });
        console.log('Characteristic cached:', writable.serviceUUID, writable.characteristic.uuid);
      } else {
        console.warn('No writable characteristic found');
      }

      setConnectedDevice(connection);
      onConnectedCb?.(connection);

      connection.onDisconnected((error, dev) => {
        setConnectedDevice(null);
        setCachedCharacteristic(null); // Reset cache saat disconnect
        onDisconnectedCb?.(dev ?? null, error ?? undefined);
      });
    } catch (e) {
      console.log('CONNECT ERROR', e);
    }
  };

  const disconnectFromDevice = async () => {
    if (!connectedDevice) return;

    await bleManager.cancelDeviceConnection(connectedDevice.id);
    onDisconnectedCb?.(connectedDevice);
    setAllDevices([]);
    setConnectedDevice(null);
    setCachedCharacteristic(null); // Reset cache
  };

  const sendDataAuto = async (data: string) => {
    if (!connectedDevice) throw new Error('No device connected');

    // Gunakan cached characteristic jika tersedia
    if (!cachedCharacteristic) {
      throw new Error('No cached characteristic available. Device may not be fully connected.');
    }

    const encoded = base64.encode(data);
    const { serviceUUID, characteristicUUID, isWritableWithResponse } = cachedCharacteristic;

    // Kirim data langsung tanpa perlu mencari characteristic lagi
    if (isWritableWithResponse) {
      await connectedDevice.writeCharacteristicWithResponseForService(
        serviceUUID,
        characteristicUUID,
        encoded
      );
    } else {
      await connectedDevice.writeCharacteristicWithoutResponseForService(
        serviceUUID,
        characteristicUUID,
        encoded
      );
    }
  };

  const sendJson = async (json: Record<string, any>) => {
    await sendDataAuto(JSON.stringify(json));
  };

  const onConnected = (cb: (device: Device) => void) => {
    setOnConnectedCb(() => cb);
  };

  const onDisconnected = (cb: (device: Device | null, error?: BleError) => void) => {
    setOnDisconnectedCb(() => cb);
  };

  return {
    allDevices,
    connectedDevice,
    isScanning,
    requestPermissions,
    scanForPeripherals,
    connectToDevice,
    disconnectFromDevice,
    sendDataAuto,
    sendJson,
    onConnected,
    onDisconnected,
  };
}

export default useBLE;
