import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useBLEContext } from '@/contexts/BleContext';
import { formatTime } from '@/lib/utils';
import { Icon } from './ui/icon';
import { Pause, Play, Music2 } from 'lucide-react-native';

const MediaPlayer = () => {
  const { mediaListener } = useBLEContext();
  const { mediaData } = mediaListener;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (mediaData?.position && mediaData?.duration && mediaData.duration > 0) {
      setProgress(Math.min((mediaData.position / mediaData.duration) * 100, 100));
    } else {
      setProgress(0);
    }
  }, [mediaData?.position, mediaData?.duration]);

  if (!mediaData) return null;

  return (
    <View className="rounded-[32px] bg-[#111] p-6">
      {/* ARTWORK */}
      <View className="mb-6 items-center">
        <View className="h-[60px] w-[60px] items-center justify-center rounded-full bg-[#1a1a1a]">
          <Icon as={Music2} size={24} color="#3B82F6" />
        </View>
      </View>

      {/* TITLE */}
      <Text numberOfLines={1} className="text-center text-[18px] font-semibold text-white">
        {mediaData.title}
      </Text>

      <Text numberOfLines={1} className="mt-1 text-center text-[13px] text-gray-400">
        {mediaData.artist}
      </Text>

      {/* PROGRESS */}
      <View className="mt-3.5">
        <View className="h-[2px] overflow-hidden rounded-full bg-white/10">
          <View className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
        </View>

        <View className="mt-1.5 flex-row justify-between">
          <Text className="text-[11px] text-gray-500">{formatTime(mediaData.position)}</Text>
          <Text className="text-[11px] text-gray-500">{formatTime(mediaData.duration)}</Text>
        </View>
      </View>

      {/* PLAY BUTTON */}
      <View className="mt-1.5 items-center">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-blue-500">
          <Icon as={mediaData.isPlaying ? Pause : Play} size={16} color="#fff" />
        </View>
      </View>
    </View>
  );
};

export default MediaPlayer;
