import { PulseLayer } from '@/components/PulseLayer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import useBLE from '@/hooks/useBLE';
import { Bluetooth, BluetoothSearching } from 'lucide-react-native';
import * as React from 'react';
import { Text, View } from 'react-native';

export default function Screen() {
  const [isScanning, setIsScanning] = React.useState<boolean>(false);

  const { scanForPeripherals, requestPermissions, allDevices } = useBLE();

  const scanForDevices = async () => {
    const isPermissionsEnabled = await requestPermissions();
    if (isPermissionsEnabled) {
      setIsScanning(true);
      scanForPeripherals();
    }
  };

  React.useEffect(() => {
    console.log(`allDevices`, allDevices);
  }, [allDevices]);

  return (
    <>
      <View className="flex-1 items-center justify-center gap-8 p-4">
        <View className="relative flex h-48 w-48 items-center justify-center">
          <PulseLayer delay={0} baseOpacity={0.4} />
          <PulseLayer delay={400} baseOpacity={0.4} />
          <PulseLayer delay={800} baseOpacity={0.4} />

          <Button
            onPress={scanForDevices}
            disabled={isScanning}
            className="h-48 w-48 rounded-full bg-background">
            <Icon
              className="text-blue-600"
              as={isScanning ? BluetoothSearching : Bluetooth}
              size={64}
            />
          </Button>
        </View>
        <View className="mt-14 w-full">
          {isScanning && allDevices.length < 1 ? (
            <View className="flex flex-col gap-6 px-4">
              <Text className="text-center text-lg font-medium text-gray-400">
                Turn on the bluetooth connection of this device
              </Text>
              <Button
                onPress={scanForDevices}
                disabled={isScanning}
                className="h-14 rounded-full bg-blue-500">
                <Text className="text-lg font-bold text-white">SCAN</Text>
              </Button>
            </View>
          ) : (
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-white">Card Title</CardTitle>
                <CardDescription className="text-white">Card Description</CardDescription>
              </CardHeader>
              <CardContent>
                <Text className="text-white">Card Content</Text>
              </CardContent>
              <CardFooter>
                <Text className="text-white">Card Footer</Text>
              </CardFooter>
            </Card>
          )}
        </View>
      </View>
    </>
  );
}
