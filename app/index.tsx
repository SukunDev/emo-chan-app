import { PulseLayer } from '@/components/PulseLayer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Bluetooth } from 'lucide-react-native';
import * as React from 'react';
import { Text, View } from 'react-native';

export default function Screen() {
  return (
    <>
      <View className="items-center justify-center flex-1 gap-8 p-4">
        <View className="relative flex items-center justify-center w-48 h-48">
          <PulseLayer delay={0} baseOpacity={0.4} />
          <PulseLayer delay={400} baseOpacity={0.4} />
          <PulseLayer delay={800} baseOpacity={0.4} />

          <Button className="w-48 h-48 rounded-full bg-background">
            <Icon className="text-blue-600" as={Bluetooth} size={64} />
          </Button>
        </View>
        <View className="mt-14">
          <View className="flex flex-col gap-6 px-4">
            <Text className="text-lg font-medium text-center text-gray-400">
              Turn on the bluetooth connection of this device
            </Text>
            <Button className="bg-blue-500 rounded-full h-14">
              <Text className="text-lg font-bold text-white">SCAN</Text>
            </Button>
          </View>
        </View>
      </View>
    </>
  );
}
