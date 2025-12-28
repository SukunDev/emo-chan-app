import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getAppName = (packageName: string): string => {
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

export const formatTime = (ms?: number): string => {
  if (!ms) return '0:00';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};
