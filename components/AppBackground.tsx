import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUIState } from '@/store/uiState';
import { gradients, gradientLocations } from '@/theme/gradients';

export default function AppBackground({ children }: { children: React.ReactNode }) {
  const { backgroundMode } = useUIState();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: backgroundMode === 'postLog' ? 1 : 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [backgroundMode, fadeAnim]);

  return (
    <>
      <LinearGradient
        colors={[...gradients.default]}
        locations={[...gradientLocations]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={[...gradients.postLog]}
          locations={[...gradientLocations]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </Animated.View>

      {children}
    </>
  );
}

