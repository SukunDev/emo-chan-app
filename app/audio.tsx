// app/audio.tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { useAudioListener } from '@/hooks/useAudioListener';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react-native';
import * as React from 'react';
import { Text, View, ScrollView, Animated } from 'react-native';

export default function AudioScreen() {
  const {
    isAvailable,
    hasPermission,
    isListening,
    audioMetrics,
    error,
    startListening,
    stopListening,
    requestPermission,
    debugAudioState,
  } = useAudioListener();

  // Animated values for visualizer
  const amplitudeAnim = React.useRef(new Animated.Value(0)).current;
  const rmsAnim = React.useRef(new Animated.Value(0)).current;

  // Animate audio metrics
  React.useEffect(() => {
    if (audioMetrics) {
      Animated.parallel([
        Animated.timing(amplitudeAnim, {
          toValue: audioMetrics.amplitude,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(rmsAnim, {
          toValue: audioMetrics.rms,
          duration: 100,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [audioMetrics]);

  // Color based on RMS level
  const getRmsColor = (rms: number): string => {
    if (rms < 0.1) return 'bg-green-500';
    if (rms < 0.3) return 'bg-yellow-500';
    if (rms < 0.6) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (!isAvailable) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Icon as={AlertCircle} size={64} className="mb-4 text-red-500" />
        <Text className="text-center text-xl text-white">Audio Listener Not Available</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <View className="min-h-screen flex-1 p-6">
        {/* Header */}
        <View className="mb-8 mt-8 items-center">
          <View className="mb-4 rounded-full bg-blue-500/20 p-6">
            <Icon as={isListening ? Mic : MicOff} size={64} className="text-blue-500" />
          </View>
          <Text className="text-3xl font-bold text-white">Audio Monitor</Text>
          <Text className="mt-2 text-gray-400">Real-time audio amplitude tracking</Text>
        </View>

        {/* Error */}
        {error && (
          <Card className="mb-6 w-full border-red-500/20">
            <CardHeader>
              <CardTitle className="text-red-400">Error</CardTitle>
            </CardHeader>
            <CardContent>
              <Text className="text-red-300">{error}</Text>
            </CardContent>
          </Card>
        )}

        {/* Permission Request */}
        {!hasPermission && (
          <Card className="mb-6 w-full border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-white">Microphone Permission Required</CardTitle>
              <CardDescription className="text-gray-400">
                This app needs microphone access to monitor audio levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onPress={requestPermission} className="h-12 rounded-full bg-blue-600">
                <Text className="font-bold text-white">Grant Permission</Text>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        <Card className="mb-6 w-full border-blue-500/20">
          <CardContent className="items-center py-8">
            <Button
              onPress={isListening ? stopListening : startListening}
              className={`h-16 rounded-full px-8 ${isListening ? 'bg-red-600' : 'bg-blue-600'}`}>
              <Icon as={isListening ? MicOff : Mic} size={24} className="mr-3 text-white" />
              <Text className="text-lg font-bold text-white">
                {isListening ? 'Stop Listening' : 'Start Listening'}
              </Text>
            </Button>
            {isListening && (
              <Button
                onPress={async () => {
                  const state = await debugAudioState();
                  console.log('🔍 Full Debug:', JSON.stringify(state, null, 2));
                }}
                className="mt-4 h-12 rounded-full bg-orange-600">
                <Text className="font-bold text-white">Debug Audio State</Text>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Audio Metrics Visualization */}
        {isListening && audioMetrics && (
          <View className="gap-4">
            {/* RMS Meter */}
            <Card className="w-full border-purple-500/20">
              <CardHeader>
                <View className="flex-row items-center justify-between">
                  <CardTitle className="text-white">RMS Level</CardTitle>
                  <Text
                    className={`text-2xl font-bold ${
                      audioMetrics.isSilent ? 'text-gray-500' : 'text-green-500'
                    }`}>
                    {audioMetrics.rms.toFixed(3)}
                  </Text>
                </View>
              </CardHeader>
              <CardContent>
                <View className="h-8 overflow-hidden rounded-full bg-gray-900">
                  <Animated.View
                    className={getRmsColor(audioMetrics.rms)}
                    style={{
                      height: '100%',
                      width: rmsAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    }}
                  />
                </View>
              </CardContent>
            </Card>

            {/* Detailed Metrics */}
            <Card className="w-full border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">Audio Metrics</CardTitle>
              </CardHeader>
              <CardContent className="gap-4">
                {/* Amplitude */}
                <View>
                  <View className="mb-2 flex-row justify-between">
                    <Text className="text-gray-400">Amplitude</Text>
                    <Text className="font-semibold text-white">
                      {audioMetrics.amplitude.toFixed(3)}
                    </Text>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-gray-900">
                    <View
                      className="h-full bg-blue-500"
                      style={{ width: `${audioMetrics.amplitude * 100}%` }}
                    />
                  </View>
                </View>

                {/* Peak */}
                <View>
                  <View className="mb-2 flex-row justify-between">
                    <Text className="text-gray-400">Peak</Text>
                    <Text className="font-semibold text-white">{audioMetrics.peak.toFixed(3)}</Text>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-gray-900">
                    <View
                      className="h-full bg-yellow-500"
                      style={{ width: `${audioMetrics.peak * 100}%` }}
                    />
                  </View>
                </View>

                {/* Status */}
                <View className="flex-row items-center justify-between border-t border-gray-800 pt-4">
                  <Text className="text-gray-400">Status</Text>
                  <View className="flex-row items-center gap-2">
                    <View
                      className={`h-3 w-3 rounded-full ${
                        audioMetrics.isSilent ? 'bg-gray-500' : 'bg-green-500'
                      }`}
                    />
                    <Text className="font-semibold text-white">
                      {audioMetrics.isSilent ? 'Silent' : 'Active'}
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* Info Card */}
        {!isListening && (
          <Card className="w-full border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">System Audio Capture</CardTitle>
            </CardHeader>
            <CardContent className="gap-3">
              <Text className="leading-6 text-gray-300">
                This app captures <Text className="font-bold text-white">system audio</Text> only
                (music, videos, games), not external sounds.
              </Text>
              <Text className="mt-2 leading-6 text-gray-300">
                You'll see a "Start screen capture" dialog. This is required by Android to capture
                audio from apps like:
              </Text>
              <View className="mt-2 rounded-lg bg-blue-500/10 p-3">
                <Text className="text-blue-300">• Spotify, YouTube Music</Text>
                <Text className="text-blue-300">• YouTube, Netflix</Text>
                <Text className="text-blue-300">• Games and other media apps</Text>
              </View>
              <Text className="mt-3 text-sm text-gray-400">⚠️ Requires Android 10 or higher</Text>
            </CardContent>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
