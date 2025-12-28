// hooks/useAudioListener.ts
import { useEffect, useState, useCallback } from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';

const { AudioListener } = NativeModules;
const eventEmitter = new NativeEventEmitter(AudioListener);

export interface AudioMetrics {
  amplitude: number;
  peak: number;
  rms: number;
  isSilent: boolean;
  timestamp: number;
}

export interface AudioListenerApi {
  isAvailable: boolean;
  hasPermission: boolean;
  isListening: boolean;
  audioMetrics: AudioMetrics | null;
  error: string | null;

  startListening: () => Promise<boolean>;
  stopListening: () => Promise<void>;
  requestPermission: () => Promise<boolean>;
  releasePermission: () => Promise<void>;
  checkPermission: () => Promise<boolean>;
  debugAudioState: () => Promise<unknown>;
}

export function useAudioListener(): AudioListenerApi {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [audioMetrics, setAudioMetrics] = useState<AudioMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check availability (Android 10+)
  useEffect(() => {
    if (Platform.OS !== 'android') {
      setIsAvailable(false);
      setError('Audio capture only available on Android');
      return;
    }

    AudioListener.isAvailable()
      .then((available: boolean) => {
        setIsAvailable(available);
        if (!available) {
          setError('Audio capture requires Android 10 or higher');
        }
      })
      .catch(() => {
        setIsAvailable(false);
        setError('Failed to check availability');
      });
  }, []);

  // Check permission
  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android') return false;

    try {
      const granted = await AudioListener.checkPermission();
      setHasPermission(granted);
      return granted;
    } catch (err) {
      console.error('Failed to check permission:', err);
      return false;
    }
  }, []);

  // Request MediaProjection permission
  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android' || !isAvailable) {
      setError('Audio capture not available');
      return false;
    }

    try {
      const granted = await AudioListener.requestPermission();
      setHasPermission(granted);

      if (!granted) {
        setError('Screen capture permission denied. This is required to capture system audio.');
      } else {
        setError(null);
      }

      return granted;
    } catch (err) {
      console.error('Failed to request permission:', err);
      setError(err instanceof Error ? err.message : 'Permission request failed');
      return false;
    }
  }, [isAvailable]);

  // Start listening
  const startListening = useCallback(async () => {
    if (Platform.OS !== 'android' || !isAvailable) {
      setError('Audio listener not available');
      return false;
    }

    if (isListening) {
      console.log('Audio listener already running');
      return true;
    }

    try {
      // Check permission first
      const granted = await checkPermission();
      if (!granted) {
        const requested = await requestPermission();
        if (!requested) {
          setError('Permission required to capture system audio');
          return false;
        }
      }

      // Start listening
      await AudioListener.start();
      setIsListening(true);
      setError(null);
      console.log('✅ Audio listener started (capturing system audio)');
      return true;
    } catch (err) {
      console.error('Failed to start audio listener:', err);
      setError(err instanceof Error ? err.message : 'Failed to start');
      setIsListening(false);
      return false;
    }
  }, [isAvailable, isListening, checkPermission, requestPermission]);

  // Stop listening
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      await AudioListener.stop();
      setIsListening(false);
      setAudioMetrics(null);
      console.log('🛑 Audio listener stopped');
    } catch (err) {
      console.error('Failed to stop audio listener:', err);
    }
  }, [isListening]);

  const debugAudioState = useCallback(async () => {
    try {
      const state = await AudioListener.debugAudioState();
      console.log('🔍 Audio State:', state);
      return state;
    } catch (err) {
      console.error('Debug failed:', err);
    }
  }, []);

  // Release MediaProjection permission completely
  const releasePermission = useCallback(async () => {
    try {
      await AudioListener.releaseProjection();
      setHasPermission(false);
      console.log('📴 MediaProjection released');
    } catch (err) {
      console.error('Failed to release projection:', err);
    }
  }, []);

  // Listen to audio data events
  useEffect(() => {
    if (!isListening) return;

    const subscription = eventEmitter.addListener('onAudioData', (metrics: AudioMetrics) => {
      setAudioMetrics(metrics);
    });

    return () => {
      subscription.remove();
    };
  }, [isListening]);

  // Listen to projection stopped event
  useEffect(() => {
    const subscription = eventEmitter.addListener('onProjectionStopped', () => {
      console.log('⚠️ MediaProjection stopped by system');
      setHasPermission(false);
      setIsListening(false);
      setError('Screen capture permission was revoked');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Initial permission check
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        stopListening();
      }
    };
  }, [isListening, stopListening]);

  return {
    isAvailable,
    hasPermission,
    isListening,
    audioMetrics,
    error,
    startListening,
    stopListening,
    requestPermission,
    releasePermission,
    checkPermission,
    debugAudioState,
  };
}
