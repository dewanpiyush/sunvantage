import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useDawn } from '@/hooks/use-dawn';

export default function VantageHuntArrivalOverlay() {
  const Dawn = useDawn();

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: Dawn.surface.card }]} pointerEvents="auto">
        <ActivityIndicator color={Dawn.accent.sunrise} style={styles.spinner} />
        <Text style={[styles.line, { color: Dawn.text.primary }]}>Finding your morning...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 20, 37, 0.42)',
  },
  card: {
    paddingVertical: 28,
    paddingHorizontal: 32,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 240,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  spinner: {
    marginBottom: 14,
  },
  line: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
