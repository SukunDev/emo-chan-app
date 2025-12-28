// hooks/useMediaListener.ts
import { useEffect, useState } from 'react';
import {
  NativeModules,
  NativeEventEmitter,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';

const { MediaListener } = NativeModules;
const eventEmitter = new NativeEventEmitter(MediaListener);

interface MediaData {
  title?: string;
  artist?: string;
  album?: string;
  package?: string;
  isPlaying: boolean;
  position?: number; // ✅ Posisi playback dalam ms
  duration?: number; // ✅ Durasi total dalam ms
  timestamp?: number; // ✅ Timestamp update
}

export interface MediaListenerApi {
  mediaData: MediaData | null;
  hasPermission: boolean;
  isChecking: boolean;
  error: string | null;
  lastUpdate: number;
  openSettings: () => Promise<void>;
  recheckPermission: () => Promise<void>;
}

export function useMediaListener(): MediaListenerApi {
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  const checkPermission = async () => {
    if (Platform.OS !== 'android') {
      setIsChecking(false);
      return;
    }

    try {
      setIsChecking(true);
      const granted = await MediaListener.checkPermission();
      setHasPermission(granted);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check permission');
      setHasPermission(false);
    } finally {
      setIsChecking(false);
    }
  };

  const openSettings = async () => {
    try {
      await MediaListener.openNotificationSettings();
    } catch (err) {
      console.error('Failed to open settings:', err);
    }
  };

  // Monitor app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Start listening dengan real-time updates
  useEffect(() => {
    if (Platform.OS !== 'android' || !hasPermission) return;

    const subscription = eventEmitter.addListener('onMediaUpdate', (data: MediaData) => {
      // Filter null/empty data
      if (data.title || data.package) {
        setMediaData(data);
        setLastUpdate(Date.now());
        console.log('📻 Media Update:', {
          title: data.title,
          artist: data.artist,
          isPlaying: data.isPlaying,
          position: data.position,
          duration: data.duration,
        });
      } else {
        // No media playing
        setMediaData(null);
      }
    });

    MediaListener.startListening()
      .then(() => {
        console.log('✅ Media listener started with real-time updates');
        setError(null);
      })
      .catch((err: Error) => {
        console.error('❌ Failed to start listener:', err);
        setError(err.message);
      });

    return () => {
      subscription.remove();
      MediaListener.stopListening().catch(console.error);
    };
  }, [hasPermission]);

  // Initial permission check
  useEffect(() => {
    checkPermission();
  }, []);

  return {
    mediaData,
    hasPermission,
    isChecking,
    error,
    lastUpdate,
    openSettings,
    recheckPermission: checkPermission,
  };
}
