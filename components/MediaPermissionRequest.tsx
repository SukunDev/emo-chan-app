// components/MediaPermissionRequest.tsx
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { AlertCircle, Settings } from 'lucide-react-native';

interface MediaPermissionRequestProps {
  onOpenSettings: () => void;
  onRecheck: () => void;
  isChecking: boolean;
}

export function MediaPermissionRequest({
  onOpenSettings,
  onRecheck,
  isChecking,
}: MediaPermissionRequestProps) {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6">
      <View className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <View className="mb-4 items-center">
          <View className="mb-4 rounded-full bg-orange-100 p-4">
            <AlertCircle size={48} color="#f97316" />
          </View>
          <Text className="mb-2 text-center text-2xl font-bold text-gray-900">
            Permission Required
          </Text>
          <Text className="text-center text-base text-gray-600">
            To display what you're currently playing, this app needs access to your device's
            notification listener.
          </Text>
        </View>

        <View className="mb-6 rounded-lg bg-blue-50 p-4">
          <Text className="mb-2 text-sm font-semibold text-blue-900">📱 How to enable:</Text>
          <Text className="text-sm leading-6 text-blue-800">
            1. Tap "Open Settings" below{'\n'}
            2. Find and select "{/* App name akan otomatis */}"{'\n'}
            3. Toggle the switch to enable{'\n'}
            4. Return to this app
          </Text>
        </View>

        <Pressable
          onPress={onOpenSettings}
          className="mb-3 rounded-xl bg-blue-600 py-4 active:bg-blue-700">
          <View className="flex-row items-center justify-center">
            <Settings size={20} color="white" />
            <Text className="ml-2 text-base font-semibold text-white">Open Settings</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onRecheck}
          disabled={isChecking}
          className="rounded-xl bg-gray-200 py-4 active:bg-gray-300">
          {isChecking ? (
            <ActivityIndicator color="#4b5563" />
          ) : (
            <Text className="text-center text-base font-semibold text-gray-700">
              I've Enabled Permission
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
