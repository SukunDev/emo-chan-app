'use client';

import { useAudioListener, AudioListenerApi } from '@/hooks/useAudioListener';
import useBLE, { BluetoothLowEnergyApi } from '@/hooks/useBLE';
import { useMediaListener, MediaListenerApi } from '@/hooks/useMediaListener';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

interface BLEContextType {
  bleManager: BluetoothLowEnergyApi;
  audioListener: AudioListenerApi;
  mediaListener: MediaListenerApi;
}

const BLEContext = createContext<BLEContextType | undefined>(undefined);

export function BLEProvider({ children }: { children: React.ReactNode }) {
  const bleManager = useBLE();
  const audioListener = useAudioListener();
  const mediaListener = useMediaListener();

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
