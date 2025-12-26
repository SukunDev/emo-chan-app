import * as React from 'react';
import { Animated, Easing } from 'react-native';

type Props = {
  delay: number;
  baseOpacity: number;
};

export function PulseLayer({ delay, baseOpacity }: Props) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(baseOpacity)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),

        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2,
            duration: 1400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),

        // reset instan
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: baseOpacity,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 9999,
        backgroundColor: '#2563eb',
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}
