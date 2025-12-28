import { useAudioListener, AudioListenerApi } from '@/hooks/useAudioListener';
import useNativeBLE, { NativeBluetoothLowEnergyApi } from '@/hooks/useNativeBLE';
import { useMediaListener, MediaListenerApi } from '@/hooks/useMediaListener';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
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

  // Refs untuk throttling yang lebih agresif
  const lastSentTime = useRef<number>(0);
  const isSending = useRef<boolean>(false);
  const lastSentData = useRef<string>('');

  // Throttle interval lebih kecil untuk realtime
  const throttleInterval = 30; // 30ms = ~33 FPS

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

    // Skip jika belum waktunya atau masih mengirim
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

    // Skip jika data sama dengan yang terakhir dikirim (optimisasi)
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

  // Gunakan interval yang lebih agresif untuk update
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
