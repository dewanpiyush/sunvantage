/**
 * Side navigation drawer: slides in from the left, ~60–65% width.
 * Brand-led header with tagline; dims app; tap outside or ✕ dismisses.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dawn } from '../constants/theme';

const PANEL_WIDTH_RATIO = 0.62;
const PANEL_PADDING_H = 24;
const SECTION_GAP = 26;
const TITLE_TO_TAGLINE = 6;
const TAGLINE_TO_FIRST_SECTION = 28;
const SECTION_TITLE_TO_ITEMS = 12;
const ITEM_GAP = 10;
const ROW_MIN_HEIGHT = 50;
const EMOJI_WIDTH = 28;
const SIGN_OUT_DIVIDER_MARGIN_TOP = 24;
const SIGN_OUT_DIVIDER_MARGIN_BOTTOM = 12;
/** Extra top offset as a fraction of safe area (so header doesn’t cut into status bar / notch). */
const PANEL_TOP_OFFSET_RATIO = 0.25;

type NavItem = {
  emoji: string;
  label: string;
  route: string | null;
  show?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  hasLoggedToday: boolean;
  showMyCitySunrises: boolean;
  onSignOut: () => void;
};

export default function NavigationOverlay({
  visible,
  onClose,
  hasLoggedToday,
  showMyCitySunrises,
  onSignOut,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const panelWidth = Math.round(windowWidth * PANEL_WIDTH_RATIO);
  const panelTopPadding = insets.top + Math.round(insets.top * PANEL_TOP_OFFSET_RATIO);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateX = useRef(new Animated.Value(-panelWidth)).current;
  const [modalVisible, setModalVisible] = useState(false);

  const morningItems: NavItem[] = [
    {
      emoji: '☀️',
      label: hasLoggedToday ? "Today's Sunrise" : "Log Today's Sunrise",
      route: '/witness',
    },
    { emoji: '🌅', label: 'Plan Tomorrow', route: '/tomorrow-plan' },
    { emoji: '📷', label: 'My Mornings', route: '/my-mornings' },
  ];

  const communityItems: NavItem[] = [
    { emoji: '🌍', label: "My City's Sunrises", route: '/my-city-sunrises', show: showMyCitySunrises },
    { emoji: '🌐', label: 'Global Sunrise Map', route: '/global-sunrise-map' },
  ];

  const youItems: NavItem[] = [
    { emoji: '✨', label: 'Ritual Markers', route: '/ritual-markers' },
    { emoji: '👤', label: 'Profile', route: '/profile' },
  ];

  useEffect(() => {
    const pw = Math.round(windowWidth * PANEL_WIDTH_RATIO);
    if (visible) {
      setModalVisible(true);
      panelTranslateX.setValue(-pw);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(panelTranslateX, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(panelTranslateX, {
          toValue: -pw,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setModalVisible(false));
    }
  }, [visible, windowWidth]);

  const handleClose = () => onClose();

  const handleItemPress = (item: NavItem) => {
    if (item.route === null) {
      handleClose();
      return;
    }
    const normalizedPath = pathname.replace(/^\/+/, '') || 'home';
    const normalizedRoute = item.route.replace(/^\/+/, '');
    const isCurrent = normalizedPath === normalizedRoute || pathname === item.route;
    if (isCurrent) {
      handleClose();
      return;
    }
    handleClose();
    router.push(item.route as never);
  };

  const handleSignOut = () => {
    handleClose();
    onSignOut();
  };

  const renderSection = (title: string, items: NavItem[], isFirst: boolean) => {
    const visibleItems = items.filter((i) => i.show !== false);
    if (visibleItems.length === 0) return null;
    return (
      <View style={[styles.section, isFirst && styles.sectionFirst]} key={title}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {visibleItems.map((item) => {
          const isCurrent = item.route != null && pathname.replace(/^\/+/, '') === item.route.replace(/^\/+/, '');
          return (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.navRow,
                pressed && styles.navRowPressed,
                isCurrent && styles.navRowCurrent,
              ]}
              onPress={() => handleItemPress(item)}
            >
              <View style={styles.emojiCell}>
                <Text style={styles.navRowEmoji}>{item.emoji}</Text>
              </View>
              <Text style={[styles.navRowLabel, isCurrent && styles.navRowLabelCurrent]} numberOfLines={1}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.backdrop,
          { opacity: backdropOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }) },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            height: windowHeight,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
      >
        <SafeAreaView style={[styles.panelInner, { paddingTop: panelTopPadding }]} edges={[]}>
          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <Text style={styles.panelTitle}>SunVantage</Text>
              <Pressable
                style={({ pressed }) => [styles.closeButton, pressed && styles.navRowPressed]}
                onPress={handleClose}
                hitSlop={12}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.tagline}>Your quiet place to notice the morning.</Text>
          </View>

          {renderSection('Morning', morningItems, true)}
          {renderSection('Community', communityItems, false)}
          {renderSection('You', youItems, false)}

          <View style={styles.signOutDivider} />
          <Pressable
            style={({ pressed }) => [styles.signOutRow, pressed && styles.navRowPressed]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    backgroundColor: Dawn.background.primary,
  },
  panelInner: {
    flex: 1,
    paddingHorizontal: PANEL_PADDING_H,
  },
  headerBlock: {
    marginBottom: TAGLINE_TO_FIRST_SECTION,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: TITLE_TO_TAGLINE,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 0.8,
  },
  tagline: {
    fontSize: 13,
    color: Dawn.text.secondary,
    opacity: 0.9,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  closeButtonText: {
    fontSize: 20,
    color: Dawn.text.secondary,
    fontWeight: '300',
  },
  section: {
    marginTop: SECTION_GAP,
  },
  sectionFirst: {
    marginTop: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Dawn.text.secondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: SECTION_TITLE_TO_ITEMS,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: 12,
    marginBottom: ITEM_GAP,
  },
  navRowPressed: {
    opacity: 0.78,
  },
  navRowCurrent: {
    opacity: 0.92,
  },
  emojiCell: {
    width: EMOJI_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRowEmoji: {
    fontSize: 20,
  },
  navRowLabel: {
    fontSize: 16,
    color: Dawn.text.primary,
    flex: 1,
  },
  navRowLabelCurrent: {
    color: Dawn.text.secondary,
  },
  signOutDivider: {
    height: 1,
    backgroundColor: Dawn.border.subtle,
    marginTop: SIGN_OUT_DIVIDER_MARGIN_TOP,
    marginBottom: SIGN_OUT_DIVIDER_MARGIN_BOTTOM,
  },
  signOutRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    color: Dawn.text.secondary,
  },
});
