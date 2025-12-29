import MediaPlayer from '@/components/MediaPlayer';
import { PulseLayer } from '@/components/PulseLayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { useBLEContext } from '@/contexts/BleContext';
import {
  Bluetooth,
  BluetoothSearching,
  Cog,
  Gamepad,
  InfoIcon,
  Loader,
  Wifi,
} from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, Text, View, Alert } from 'react-native';
import type { BLEDevice } from '@/hooks/useNativeBLE';

export default function Screen() {
  const { bleManager } = useBLEContext();
  const {
    startScan,
    stopScan,
    requestPermissions,
    isBluetoothEnabled,
    connect,
    disconnect,
    allDevices,
    isScanning,
    connectedDevice,
  } = bleManager;

  const scanForDevices = async () => {
    try {
      // Check bluetooth enabled
      const btEnabled = await isBluetoothEnabled();
      if (!btEnabled) {
        Alert.alert('Bluetooth Off', 'Please turn on Bluetooth to scan for devices');
        return;
      }

      // Request permissions
      const isPermissionsEnabled = await requestPermissions();
      if (!isPermissionsEnabled) {
        Alert.alert('Permission Denied', 'Bluetooth permissions are required to scan');
        return;
      }

      // Start scanning
      await startScan();
    } catch (error) {
      console.error('Error scanning:', error);
      Alert.alert('Scan Error', 'Failed to start scanning for devices');
    }
  };

  const handleConnectToDevice = async (device: BLEDevice) => {
    try {
      // Stop scanning before connecting
      if (isScanning) {
        await stopScan();
      }

      await connect(device.id);
      Alert.alert('Connected', `Successfully connected to ${device.name}`);
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Connection Failed', 'Could not connect to device');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      Alert.alert('Disconnected', 'Device disconnected successfully');
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  return (
    <View className="items-center justify-center flex-1 p-4 bg-background">
      {connectedDevice && (
        <>
          <View className="w-full mt-14">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-400">Connected</Text>
              <View className="flex-row items-center gap-2">
                <Button onPress={handleDisconnect} size="sm" variant="ghost" className="h-6 px-2">
                  <Text className="text-xs text-gray-500">{connectedDevice?.name}</Text>
                </Button>
              </View>
            </View>
          </View>

          <View className="flex-1 w-full gap-6 mt-6">
            <MediaPlayer />
            <View className="flex-row gap-6">
              <Button className="h-36 flex-1 bg-[#111] active:scale-105 active:bg-white/30">
                <Icon as={Gamepad} size={32} className="text-white" />
              </Button>

              <Button className="h-36 flex-1 bg-[#111] active:scale-105 active:bg-white/30">
                <Icon as={Wifi} size={32} className="text-white" />
              </Button>
            </View>
            <View className="flex-row gap-6">
              <Button className="h-36 flex-1 bg-[#111] active:scale-105 active:bg-white/30">
                <Icon as={Cog} size={32} className="text-white" />
              </Button>

              <Button className="h-36 flex-1 bg-[#111] active:scale-105 active:bg-white/30">
                <Icon as={InfoIcon} size={32} className="text-white" />
              </Button>
            </View>
          </View>
        </>
      )}

      {/* SCAN BUTTON */}
      {!connectedDevice && (
        <>
          <View className="py-10">
            <View className="relative items-center justify-center w-48 h-48">
              <PulseLayer delay={0} baseOpacity={0.25} />
              <PulseLayer delay={400} baseOpacity={0.25} />
              <PulseLayer delay={800} baseOpacity={0.25} />

              <Button
                onPress={scanForDevices}
                disabled={isScanning}
                className="w-48 h-48 rounded-full bg-card">
                <Icon
                  className="text-blue-500"
                  as={isScanning ? BluetoothSearching : Bluetooth}
                  size={64}
                />
              </Button>
            </View>
          </View>

          {/* DEVICE LIST */}
          {allDevices.length < 1 ? (
            <View className="items-center gap-4 pt-10">
              <Text className="text-lg font-medium text-center text-gray-400">
                Turn on the bluetooth connection of this device
              </Text>

              <Button
                onPress={scanForDevices}
                disabled={isScanning}
                className="w-40 h-12 bg-blue-500 rounded-full">
                <Text className="font-semibold text-white">SCAN</Text>
                {isScanning && (
                  <Icon className="ml-2 text-white animate-spin" as={Loader} size={20} />
                )}
              </Button>
            </View>
          ) : (
            <Card className="mt-14 w-full flex-1 bg-white/5">
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <View>
                    <CardTitle>Available Devices</CardTitle>
                    <CardDescription>Tap a device to connect</CardDescription>
                  </View>

                  {isScanning && (
                    <View className="flex-row items-center gap-2">
                      <Icon className="text-blue-500 animate-spin" as={Loader} size={16} />
                      <Text className="text-xs text-blue-500">Scanning...</Text>
                    </View>
                  )}
                </View>
              </CardHeader>

              <CardContent className="flex-1">
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
                  {allDevices.map((device) => (
                    <View
                      key={device.id}
                      className="flex-row items-center justify-between px-4 py-3 border rounded-xl border-border bg-muted">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">
                          {device.name || 'Unknown Device'}
                        </Text>
                        <Text className="text-xs text-muted-foreground">{device.address}</Text>
                        {device.rssi && (
                          <Text className="mt-1 text-xs text-gray-500">
                            Signal: {device.rssi} dBm
                          </Text>
                        )}
                      </View>

                      <Button
                        onPress={() => handleConnectToDevice(device)}
                        size="sm"
                        className="bg-blue-500 rounded-md">
                        <Text className="text-xs font-semibold text-white">CONNECT</Text>
                      </Button>
                    </View>
                  ))}
                </ScrollView>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </View>
  );
}
