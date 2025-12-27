/* eslint-disable no-bitwise */
import { useMemo, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleManager, Characteristic, Device } from 'react-native-ble-plx';

import * as ExpoDevice from 'expo-device';

import base64 from 'react-native-base64';

interface BluetoothLowEnergyApi {
  requestPermissions(): Promise<boolean>;
  scanForPeripherals(): void;
  connectToDevice: (deviceId: Device) => Promise<void>;
  disconnectFromDevice: () => void;
  sendDataAuto: (data: string) => Promise<void>;
  sendJson: (json: Record<string, any>) => Promise<void>;
  connectedDevice: Device | null;
  allDevices: Device[];
}

function useBLE(): BluetoothLowEnergyApi {
  const bleManager = useMemo(() => new BleManager(), []);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

  const requestAndroid31Permissions = async () => {
    const bluetoothScanPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      {
        title: 'Location Permission',
        message: 'Bluetooth Low Energy requires Location',
        buttonPositive: 'OK',
      }
    );
    const bluetoothConnectPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      {
        title: 'Location Permission',
        message: 'Bluetooth Low Energy requires Location',
        buttonPositive: 'OK',
      }
    );
    const fineLocationPermission = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'Bluetooth Low Energy requires Location',
        buttonPositive: 'OK',
      }
    );

    return (
      bluetoothScanPermission === 'granted' &&
      bluetoothConnectPermission === 'granted' &&
      fineLocationPermission === 'granted'
    );
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      if ((ExpoDevice.platformApiLevel ?? -1) < 31) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bluetooth Low Energy requires Location',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const isAndroid31PermissionsGranted = await requestAndroid31Permissions();

        return isAndroid31PermissionsGranted;
      }
    } else {
      return true;
    }
  };

  const isDuplicteDevice = (devices: Device[], nextDevice: Device) =>
    devices.findIndex((device) => nextDevice.id === device.id) > -1;

  const scanForPeripherals = () =>
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log(error);
      }
      if (device) {
        setAllDevices((prevState: Device[]) => {
          if (!isDuplicteDevice(prevState, device)) {
            return [...prevState, device];
          }
          return prevState;
        });
      }
    });

  const connectToDevice = async (device: Device) => {
    try {
      const deviceConnection = await bleManager.connectToDevice(device.id);
      setConnectedDevice(deviceConnection);
      await deviceConnection.discoverAllServicesAndCharacteristics();
      bleManager.stopDeviceScan();
    } catch (e) {
      console.log('FAILED TO CONNECT', e);
    }
  };

  const disconnectFromDevice = () => {
    if (connectedDevice) {
      bleManager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null);
    }
  };

  const findWritableCharacteristic = async (device: Device) => {
    const services = await device.services();

    for (const service of services) {
      const characteristics = await service.characteristics();

      for (const char of characteristics) {
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

  const sendDataAuto = async (data: string) => {
    if (!connectedDevice) throw new Error('No device connected');

    try {
      const writable = await findWritableCharacteristic(connectedDevice);
      if (!writable) throw new Error('No writable characteristic found');

      const encoded = base64.encode(data);

      const { serviceUUID, characteristic } = writable;

      if (characteristic.isWritableWithResponse) {
        await connectedDevice.writeCharacteristicWithResponseForService(
          serviceUUID,
          characteristic.uuid,
          encoded
        );
      } else {
        await connectedDevice.writeCharacteristicWithoutResponseForService(
          serviceUUID,
          characteristic.uuid,
          encoded
        );
      }
    } catch (e) {
      console.log('SEND AUTO ERROR', e);
    }
  };

  const sendJson = async (json: Record<string, any>) => {
    await sendDataAuto(JSON.stringify(json));
  };

  return {
    scanForPeripherals,
    requestPermissions,
    connectToDevice,
    allDevices,
    connectedDevice,
    disconnectFromDevice,
    sendDataAuto,
    sendJson,
  };
}

export default useBLE;
