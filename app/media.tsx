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
import { useMediaListener } from '@/hooks/useMediaListener';
import {
  Music,
  AlertCircle,
  Settings as SettingsIcon,
  Play,
  Pause,
  Disc3,
} from 'lucide-react-native';
import * as React from 'react';
import { Text, View, ActivityIndicator, ScrollView } from 'react-native';

export default function MediaScreen() {
  const [progress, setProgress] = React.useState(0);
  const { mediaData, hasPermission, isChecking, error, openSettings, recheckPermission } =
    useMediaListener();

  // Helper function untuk nama app
  const getAppName = (packageName: string): string => {
    const appNames: Record<string, string> = {
      'com.spotify.music': 'Spotify',
      'com.google.android.youtube': 'YouTube',
      'com.google.android.apps.youtube.music': 'YouTube Music',
      'com.android.chrome': 'Chrome',
      'org.mozilla.firefox': 'Firefox',
      'com.netflix.mediaclient': 'Netflix',
      'com.apple.android.music': 'Apple Music',
      'deezer.android.app': 'Deezer',
      'com.soundcloud.android': 'SoundCloud',
    };

    return appNames[packageName] || packageName;
  };

  const formatTime = (ms?: number): string => {
    if (!ms) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  React.useEffect(() => {
    if (mediaData?.position && mediaData?.duration && mediaData.duration > 0) {
      const calculatedProgress = (mediaData.position / mediaData.duration) * 100;
      setProgress(Math.min(calculatedProgress, 100));
    } else {
      setProgress(0);
    }
  }, [mediaData?.position, mediaData?.duration]);
  // Loading State
  if (isChecking) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-4">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-gray-400">Checking permission...</Text>
      </View>
    );
  }

  // Permission Not Granted
  if (!hasPermission) {
    return (
      <ScrollView className="flex-1 bg-background">
        <View className="min-h-screen flex-1 items-center justify-center p-6">
          <View className="w-full max-w-md">
            {/* Icon */}
            <View className="mb-8 items-center">
              <View className="mb-4 rounded-full bg-orange-500/20 p-6">
                <Icon as={AlertCircle} size={64} className="text-orange-500" />
              </View>
              <Text className="mb-2 text-center text-3xl font-bold text-white">
                Permission Required
              </Text>
              <Text className="text-center text-base text-gray-400">
                To display what you're currently playing, this app needs access to your device's
                notification listener.
              </Text>
            </View>

            {/* Instructions Card */}
            <Card className="mb-6 w-full border-blue-500/20">
              <CardHeader>
                <CardTitle className="text-white">📱 How to Enable</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="gap-3">
                  <View className="flex-row gap-3">
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                      <Text className="text-xs font-bold text-blue-400">1</Text>
                    </View>
                    <Text className="flex-1 text-gray-300">Tap "Open Settings" below</Text>
                  </View>
                  <View className="flex-row gap-3">
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                      <Text className="text-xs font-bold text-blue-400">2</Text>
                    </View>
                    <Text className="flex-1 text-gray-300">
                      Find and select this app in the list
                    </Text>
                  </View>
                  <View className="flex-row gap-3">
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                      <Text className="text-xs font-bold text-blue-400">3</Text>
                    </View>
                    <Text className="flex-1 text-gray-300">Toggle the switch to enable</Text>
                  </View>
                  <View className="flex-row gap-3">
                    <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/20">
                      <Text className="text-xs font-bold text-blue-400">4</Text>
                    </View>
                    <Text className="flex-1 text-gray-300">Return to this app</Text>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <View className="gap-3">
              <Button onPress={openSettings} className="h-14 rounded-full bg-blue-600">
                <Icon as={SettingsIcon} size={20} className="mr-2 text-white" />
                <Text className="text-base font-bold text-white">Open Settings</Text>
              </Button>

              <Button
                onPress={recheckPermission}
                variant="outline"
                className="h-14 rounded-full border-gray-700">
                <Text className="text-base font-semibold text-white">I've Enabled Permission</Text>
              </Button>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  }

  // Permission Granted - Show Media Info
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="min-h-screen flex-1 p-6">
        {/* Header */}
        <View className="mb-8 mt-8 items-center">
          <View className="mb-4 rounded-full bg-purple-500/20 p-6">
            <Icon as={Music} size={64} className="text-purple-500" />
          </View>
          <Text className="text-3xl font-bold text-white">Now Playing</Text>
          <Text className="mt-2 text-gray-400">Real-time media tracking</Text>
        </View>

        {/* Error State */}
        {error && (
          <Card className="mb-6 w-full border-red-500/20">
            <CardHeader>
              <CardTitle className="text-red-400">Error Occurred</CardTitle>
            </CardHeader>
            <CardContent>
              <Text className="text-red-300">{error}</Text>
            </CardContent>
          </Card>
        )}

        {/* No Media Playing */}
        {!mediaData && !error && (
          <Card className="w-full border-gray-800">
            <CardContent className="items-center py-12">
              <Icon as={Disc3} size={64} className="mb-4 text-gray-700" />
              <Text className="mb-2 text-center text-lg text-gray-400">No media playing</Text>
              <Text className="text-center text-sm text-gray-500">
                Play something on Spotify, YouTube, or any music app
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Media Playing */}
        {mediaData && (
          <View className="gap-6">
            {/* Main Card */}
            <Card className="w-full border-purple-500/20">
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <CardTitle className="mb-1 text-2xl text-white">
                      {mediaData.title || 'Unknown'}
                    </CardTitle>
                    <CardDescription className="text-base text-gray-400">
                      {mediaData.artist || 'Unknown Artist'}
                    </CardDescription>
                  </View>
                  <View className="rounded-full bg-purple-500/20 p-3">
                    <Icon
                      as={mediaData.isPlaying ? Play : Pause}
                      size={24}
                      className="text-purple-500"
                    />
                  </View>
                </View>
              </CardHeader>

              {mediaData.album && (
                <CardContent>
                  <View className="rounded-lg bg-gray-900/50 p-4">
                    <Text className="mb-1 text-xs text-gray-500">Album</Text>
                    <Text className="text-base text-gray-300">{mediaData.album}</Text>
                  </View>
                  <View className="mb-4 gap-2">
                    <View className="h-1 overflow-hidden rounded-full bg-gray-800">
                      <View className="h-full bg-purple-500" style={{ width: `${progress}%` }} />
                    </View>
                    <View className="flex-row justify-between">
                      <Text className="text-xs text-gray-500">
                        {formatTime(mediaData.position)}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {formatTime(mediaData.duration)}
                      </Text>
                    </View>
                  </View>
                </CardContent>
              )}

              <CardFooter className="flex-row items-center justify-between border-t border-gray-800">
                <View className="flex-row items-center gap-2">
                  <View
                    className={`h-3 w-3 rounded-full ${
                      mediaData.isPlaying ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                  />
                  <Text className="text-sm font-medium text-white">
                    {mediaData.isPlaying ? 'Playing' : 'Paused'}
                  </Text>
                </View>
                <Text className="text-sm text-gray-500">{getAppName(mediaData.package || '')}</Text>
              </CardFooter>
            </Card>

            {/* Info Cards */}
            <View className="gap-4">
              <Card className="w-full border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base text-white">Source Application</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text className="text-lg font-semibold text-gray-300">
                    {getAppName(mediaData.package || '')}
                  </Text>
                  <Text className="mt-1 text-xs text-gray-500">{mediaData.package}</Text>
                </CardContent>
              </Card>

              <Card className="w-full border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base text-white">Playback Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <View className="flex-row items-center gap-3">
                    <View
                      className={`h-12 w-12 items-center justify-center rounded-full ${
                        mediaData.isPlaying ? 'bg-green-500/20' : 'bg-gray-500/20'
                      }`}>
                      <Icon
                        as={mediaData.isPlaying ? Play : Pause}
                        size={24}
                        className={mediaData.isPlaying ? 'text-green-500' : 'text-gray-500'}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg font-semibold text-white">
                        {mediaData.isPlaying ? 'Currently Playing' : 'Paused'}
                      </Text>
                      <Text className="text-sm text-gray-500">
                        {mediaData.isPlaying ? 'Audio is active' : 'Playback paused'}
                      </Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
