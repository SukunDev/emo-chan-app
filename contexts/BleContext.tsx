import { useAudioListener, AudioListenerApi } from '@/hooks/useAudioListener';
import useNativeBLE, { NativeBluetoothLowEnergyApi } from '@/hooks/useNativeBLE';
import { useMediaListener, MediaListenerApi } from '@/hooks/useMediaListener';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

interface BLEContextType {
  bleManager: NativeBluetoothLowEnergyApi;
  audioListener: AudioListenerApi;
  mediaListener: MediaListenerApi;
}

const BLEContext = createContext<BLEContextType | undefined>(undefined);

export function BLEProvider({ children }: { children: React.ReactNode }) {
  const bleManager = useNativeBLE();
  const audioListener = useAudioListener();
  const mediaListener = useMediaListener();

  const { connectedDevice, sendJson } = bleManager;

  const {
    mediaData,
    hasPermission: mediaListenerPermission,
    isChecking,
    error: mediaListenerError,
    openSettings,
  } = mediaListener;

  const {
    isAvailable,
    hasPermission: audioListenerPermission,
    isListening,
    audioMetrics,
    error: audioListenerError,
    startListening,
    stopListening,
    requestPermission,
  } = audioListener;

  // State untuk tracking reconnection
  const [isReconnecting, setIsReconnecting] = useState(false);
  const hasCheckedExistingConnection = useRef(false);

  // Refs untuk throttling
  const lastSentTime = useRef<number>(0);
  const isSending = useRef<boolean>(false);
  const lastSentData = useRef<string>('');

  const throttleInterval = 30;

  // Check if BLEModule is available
  useEffect(() => {
    const checkBLEModule = async () => {
      try {
        await bleManager.isBluetoothEnabled();
      } catch (error) {
        console.error('BLE Module not available:', error);
        Alert.alert(
          'BLE Module Error',
          'Native BLE module is not properly configured. Please rebuild the app.',
          [{ text: 'OK' }]
        );
      }
    };
    checkBLEModule();
  }, []);

  // NEW: Check for existing connections when app starts
  useEffect(() => {
    const checkExistingConnections = async () => {
      if (hasCheckedExistingConnection.current) return;
      hasCheckedExistingConnection.current = true;

      try {
        const existingConnections = await bleManager.getExistingConnections();

        if (existingConnections.length > 0) {
          const device = existingConnections[0];
          console.log('Found existing connection:', device);

          Alert.alert(
            'Existing Connection Found',
            `Would you like to reconnect to ${device.name || 'Unknown Device'}?`,
            [
              {
                text: 'No',
                style: 'cancel',
              },
              {
                text: 'Yes',
                onPress: async () => {
                  setIsReconnecting(true);
                  try {
                    await bleManager.reconnectToDevice(device.address);
                    console.log('Successfully reconnected to existing device');
                  } catch (error) {
                    console.error('Failed to reconnect:', error);
                    Alert.alert(
                      'Reconnection Failed',
                      'Could not reconnect to the device. Please connect manually.',
                      [{ text: 'OK' }]
                    );
                  } finally {
                    setIsReconnecting(false);
                  }
                },
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error checking existing connections:', error);
      }
    };

    checkExistingConnections();
  }, [bleManager]);

  // NEW: Handle existing connection event from native
  useEffect(() => {
    bleManager.onExistingConnection(async (device) => {
      console.log('Existing connection event received:', device);

      // Auto-reconnect without showing alert (optional)
      if (!connectedDevice && !isReconnecting) {
        setIsReconnecting(true);
        try {
          await bleManager.reconnectToDevice(device.address);
          console.log('Auto-reconnected to existing device');
        } catch (error) {
          console.error('Auto-reconnect failed:', error);
        } finally {
          setIsReconnecting(false);
        }
      }
    });
  }, [bleManager, connectedDevice, isReconnecting]);

  useEffect(() => {
    if (!mediaListenerPermission && !isChecking && mediaListenerError === null) {
      openSettings();
    }
  }, [mediaListenerPermission, isChecking, mediaListenerError]);

  useEffect(() => {
    if (isAvailable && !audioListenerPermission && audioListenerError === null) {
      requestPermission();
    }
  }, [isAvailable, audioListenerPermission, audioListenerError]);

  useEffect(() => {
    if (audioListenerPermission && !isListening) {
      startListening();
    }
    return () => {
      if (isListening) {
        stopListening();
      }
    };
  }, [audioListenerPermission, isListening]);

  const sendEventAudioAndMediaData = useCallback(async () => {
    if (!mediaData || !audioMetrics || !connectedDevice) return;

    const now = Date.now();
    const timeSinceLastSent = now - lastSentTime.current;

    if (timeSinceLastSent < throttleInterval || isSending.current) {
      return;
    }

    const combined = {
      type: 'media',
      title: mediaData.title || 'Unknown',
      artist: mediaData.artist || 'Unknown',
      status: mediaData.isPlaying ? 'PLAYING' : 'PAUSED',
      is_playing: mediaData.isPlaying,
      audio_amplitude: {
        amplitude: audioMetrics.amplitude,
        peak: audioMetrics.peak,
        rms: audioMetrics.rms,
      },
    };

    const dataString = JSON.stringify(combined);

    if (dataString === lastSentData.current) {
      return;
    }

    isSending.current = true;
    lastSentTime.current = now;
    lastSentData.current = dataString;

    try {
      await sendJson(combined);
    } catch (error) {
      console.error('Error sending BLE data:', error);
    } finally {
      isSending.current = false;
    }
  }, [audioMetrics, mediaData, connectedDevice, sendJson, throttleInterval]);

  useEffect(() => {
    if (!connectedDevice) return;

    const intervalId = setInterval(() => {
      sendEventAudioAndMediaData();
    }, throttleInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [sendEventAudioAndMediaData, connectedDevice, throttleInterval]);

  return (
    <BLEContext.Provider
      value={{
        bleManager,
        audioListener,
        mediaListener,
      }}>
      {children}
    </BLEContext.Provider>
  );
}

export function useBLEContext() {
  const context = useContext(BLEContext);
  if (context === undefined) {
    throw new Error('useBLE must be used within an BLEProvider');
  }
  return context;
}
