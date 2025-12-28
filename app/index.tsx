import { PulseLayer } from '@/components/PulseLayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { useBLEContext } from '@/contexts/BleContext';
import { Bluetooth, BluetoothSearching, Loader } from 'lucide-react-native';
import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Device } from 'react-native-ble-plx';

export default function Screen() {
  const { bleManager } = useBLEContext();
  const {
    scanForPeripherals,
    requestPermissions,
    connectToDevice,
    allDevices,
    isScanning,
    connectedDevice,
  } = bleManager;

  const scanForDevices = async () => {
    const isPermissionsEnabled = await requestPermissions();
    if (isPermissionsEnabled) {
      scanForPeripherals();
    }
  };

  const handleConnectToDevice = async (device: Device) => {
    await connectToDevice(device);
  };

  return (
    <View className="flex-1 items-center justify-center bg-background p-4">
      {connectedDevice && (
        <View className="absolute top-10 w-full px-4">
          <Card className="w-full bg-green-500">
            <CardHeader>
              <CardTitle className="text-white">Connected to {connectedDevice.name}</CardTitle>
              <CardDescription className="text-white">
                Device ID: {connectedDevice.id}
              </CardDescription>
            </CardHeader>
          </Card>
        </View>
      )}
      {/* SCAN BUTTON */}
      {!connectedDevice && (
        <>
          <View className="py-10">
            <View className="relative h-48 w-48 items-center justify-center">
              <PulseLayer delay={0} baseOpacity={0.25} />
              <PulseLayer delay={400} baseOpacity={0.25} />
              <PulseLayer delay={800} baseOpacity={0.25} />

              <Button
                onPress={scanForDevices}
                disabled={isScanning}
                className="h-48 w-48 rounded-full bg-card">
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
              <Text className="text-center text-lg font-medium text-gray-400">
                Turn on the bluetooth connection of this device{' '}
              </Text>

              <Button
                onPress={scanForDevices}
                disabled={isScanning}
                className="h-12 w-40 rounded-full bg-blue-500">
                <Text className="font-semibold text-white">SCAN</Text>
                {isScanning && (
                  <Icon className="ml-2 animate-spin text-white" as={Loader} size={20} />
                )}
              </Button>
            </View>
          ) : (
            <Card className="mt-10 w-full flex-1">
              <CardHeader>
                <CardTitle>Available Devices</CardTitle>
                <CardDescription>Tap a device to connect</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
                  {allDevices.map((device) => (
                    <View
                      key={device.id}
                      className="flex-row items-center justify-between rounded-xl border border-border bg-muted px-4 py-3">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-foreground">
                          {device.name || 'Unknown Device'}
                        </Text>
                        <Text className="text-xs text-muted-foreground">{device.id}</Text>
                      </View>

                      <Button
                        onPress={() => handleConnectToDevice(device)}
                        size="sm"
                        className="rounded-full bg-blue-500">
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
