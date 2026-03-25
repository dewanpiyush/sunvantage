import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type BottomSheetModalProps = {
  visible: boolean;
  onClose: () => void;
  /** Optional: called after close animation ends. */
  onClosed?: () => void;
  /** 0..1 of screen height. Defaults to 0.85 */
  heightRatio?: number;
  children: React.ReactNode;
};

const DEFAULT_HEIGHT_RATIO = 0.85;
const DISMISS_DRAG_THRESHOLD_PX = 90;
const DISMISS_VELOCITY_Y = 1.2;
const ANIM_IN_MS = 220;
const ANIM_OUT_MS = 180;

export default function BottomSheetModal({
  visible,
  onClose,
  onClosed,
  heightRatio = DEFAULT_HEIGHT_RATIO,
  children,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const screenH = Dimensions.get('window').height;
  const sheetH = Math.round(screenH * heightRatio);

  const translateY = useRef(new Animated.Value(sheetH)).current;
  const dragY = useRef(0);
  const isClosingRef = useRef(false);

  const closeWithAnimation = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: sheetH,
      duration: ANIM_OUT_MS,
      useNativeDriver: true,
    }).start(() => {
      isClosingRef.current = false;
      onClose();
      onClosed?.();
    });
  }, [onClose, onClosed, sheetH, translateY]);

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(sheetH);
    Animated.timing(translateY, {
      toValue: 0,
      duration: ANIM_IN_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, sheetH, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Gesture is bound only to the drag handle, so this is safe from scroll conflicts.
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragY.current = 0;
        },
        onPanResponderMove: (_evt, gestureState) => {
          const dy = Math.max(0, gestureState.dy);
          dragY.current = dy;
          translateY.setValue(dy);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const dy = Math.max(0, gestureState.dy);
          const vy = gestureState.vy;
          const shouldDismiss = dy > DISMISS_DRAG_THRESHOLD_PX || vy > DISMISS_VELOCITY_Y;
          if (shouldDismiss) {
            closeWithAnimation();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 18,
          }).start();
        },
      }),
    [closeWithAnimation, translateY]
  );

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeWithAnimation}
    >
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={closeWithAnimation} />
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetH,
              paddingBottom: Math.max(16, insets.bottom),
              transform: [{ translateY }],
            },
          ]}
        >
          <View {...panResponder.panHandlers} style={styles.dragHandle} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0E223D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dragHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(231, 238, 247, 0.22)',
  },
});

