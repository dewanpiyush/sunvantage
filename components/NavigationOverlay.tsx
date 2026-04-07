/**
 * Side navigation drawer: slides in from the left, ~60–65% width.
 * Brand-led header with tagline; dims app; tap outside or ✕ dismisses.
 * Vertical rhythm: larger gaps between sections than between items; soft section labels.
 */

import React, { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDawn } from '@/hooks/use-dawn';

const PANEL_WIDTH_RATIO = 0.62;
const PANEL_PADDING_H = 24;
/** Space between drawer header block and first section (target 24–28px) */
const TAGLINE_TO_FIRST_SECTION = 26;
/** Space between section groups — “islands” (target 32–36px) */
const SECTION_SPACING = 30;
const TITLE_TO_TAGLINE = 3;
const SECTION_TITLE_TO_ITEMS = 8;
/** Vertical rhythm between nav rows (target 16–18px between items) */
const ITEM_GAP_BELOW_ROW = 13;
const ROW_MIN_HEIGHT = 40;
const EMOJI_WIDTH = 26;
const SIGN_OUT_DIVIDER_MARGIN_TOP = 24;
const SIGN_OUT_DIVIDER_MARGIN_BOTTOM = 10;
/** Extra top offset as a fraction of safe area (so header doesn’t cut into status bar / notch). */
const PANEL_TOP_OFFSET_RATIO = 0.25;

type NavItem = {
  emoji: string;
  label: string;
  route: string | null;
  show?: boolean;
  /** Slightly brighter label — gentle section lead (not pushy) */
  emphasis?: 'lead';
};

type Props = {
  visible: boolean;
  onClose: () => void;
  instantOpen?: boolean;
  hasLoggedToday: boolean;
  showMyCitySunrises: boolean;
  onSignOut: () => void;
};

export default function NavigationOverlay({
  visible,
  onClose,
  instantOpen = false,
  hasLoggedToday,
  showMyCitySunrises,
  onSignOut,
}: Props) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const Dawn = useDawn();
  const panelWidth = Math.round(windowWidth * PANEL_WIDTH_RATIO);
  const panelTopPadding = insets.top + Math.round(insets.top * PANEL_TOP_OFFSET_RATIO);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateX = useRef(new Animated.Value(-panelWidth)).current;
  const gestureStartY = useRef<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const morningItems: NavItem[] = [
    {
      emoji: '☀️',
      label: hasLoggedToday ? "Today's Sunrise" : "Log Today's Sunrise",
      route: '/witness',
      emphasis: 'lead',
    },
    { emoji: '🌅', label: 'Plan Tomorrow', route: '/tomorrow-plan' },
    { emoji: '📷', label: 'My Mornings', route: '/my-mornings' },
  ];

  const communityItems: NavItem[] = [
    { emoji: '🌐', label: 'Global Sunrise Map', route: '/global-sunrise-map', emphasis: 'lead' },
    { emoji: '🌍', label: "My City's Sunrises", route: '/my-city-sunrises', show: showMyCitySunrises },
    { emoji: '🖼️', label: 'World Sunrise Gallery', route: '/world-sunrise-gallery' },
  ];

  const youItems: NavItem[] = [
    { emoji: '✨', label: 'Ritual Markers', route: '/ritual-markers', emphasis: 'lead' },
    { emoji: '👤', label: 'Profile', route: '/profile' },
    { emoji: '⚙️', label: 'Settings', route: '/settings' },
  ];

  useEffect(() => {
    const pw = Math.round(windowWidth * PANEL_WIDTH_RATIO);
    if (visible) {
      setModalVisible(true);
      if (instantOpen) {
        panelTranslateX.setValue(0);
        backdropOpacity.setValue(1);
      } else {
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
      }
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

  const handlePanelTouchStart = (y: number) => {
    gestureStartY.current = y;
  };

  const handlePanelTouchEnd = (y: number) => {
    if (gestureStartY.current == null) return;
    const deltaY = y - gestureStartY.current;
    gestureStartY.current = null;
    if (deltaY > 44) {
      handleClose();
    }
  };

  const renderSection = (title: string, items: NavItem[], isFirst: boolean) => {
    const visibleItems = items.filter((i) => i.show !== false);
    if (visibleItems.length === 0) return null;
    return (
      <View style={isFirst ? styles.sectionFirst : styles.sectionAfter} key={title}>
        <Text style={[styles.sectionTitle, { color: Dawn.text.secondary }]}>{title}</Text>
        {visibleItems.map((item, index) => {
          const isCurrent =
            item.route != null && pathname.replace(/^\/+/, '') === item.route.replace(/^\/+/, '');
          const isLead = item.emphasis === 'lead';
          const isMuted = !isCurrent && !isLead;
          const isLast = index === visibleItems.length - 1;
          return (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.navRow,
                !isLast && styles.navRowWithGap,
                pressed && styles.navRowPressed,
                isCurrent && styles.navRowCurrent,
              ]}
              onPress={() => handleItemPress(item)}
            >
              <View style={styles.emojiCell}>
                <Text
                  style={[
                    styles.navRowEmoji,
                    isMuted && styles.navRowEmojiMuted,
                  ]}
                >
                  {item.emoji}
                </Text>
              </View>
              <Text
                style={[
                  styles.navRowLabel,
                  isCurrent && { color: Dawn.text.secondary },
                  !isCurrent && isLead && { color: Dawn.text.primary },
                  !isCurrent && !isLead && { color: Dawn.text.secondary },
                ]}
                numberOfLines={1}
              >
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
          {
            opacity: backdropOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0, instantOpen ? 0 : 0.6],
            }),
          },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Dedicated outside-tap hit area: always closes when user taps outside panel. */}
      <Pressable
        style={[styles.outsideTapZone, { left: panelWidth }]}
        onPress={handleClose}
      />

      <Animated.View
        style={[
          styles.panel,
          {
            width: panelWidth,
            transform: [{ translateX: panelTranslateX }],
          },
        ]}
        onTouchStart={(e) => handlePanelTouchStart(e.nativeEvent.pageY)}
        onTouchEnd={(e) => handlePanelTouchEnd(e.nativeEvent.pageY)}
      >
        <LinearGradient
          colors={['rgba(18,32,58,0.92)', 'rgba(28, 42, 74, 0.88)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <SafeAreaView style={[styles.panelInner, { paddingTop: panelTopPadding }]} edges={[]}>
          <View style={styles.panelBody}>
            <ScrollView
              style={styles.menuScroll}
              contentContainerStyle={styles.menuScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.headerBlock}>
                <View style={styles.headerRow}>
                  <Text style={[styles.panelTitle, { color: Dawn.text.primary }]}>SunVantage</Text>
                  <Pressable
                    style={({ pressed }) => [styles.closeButton, pressed && styles.navRowPressed]}
                    onPress={handleClose}
                    hitSlop={12}
                  >
                    <Text style={[styles.closeButtonText, { color: Dawn.text.secondary }]}>✕</Text>
                  </Pressable>
                </View>
                <Text style={[styles.tagline, { color: Dawn.text.secondary }]}>
                  Your quiet place to notice the morning.
                </Text>
              </View>

              {renderSection('Morning', morningItems, true)}
              {renderSection('Community', communityItems, false)}
              {renderSection('You', youItems, false)}
            </ScrollView>

            <View style={styles.signOutDock}>
              <View style={[styles.signOutDivider, { backgroundColor: Dawn.border.subtle }]} />
              <Pressable
                style={({ pressed }) => [styles.signOutRow, pressed && styles.navRowPressed]}
                onPress={handleSignOut}
              >
                <Text style={[styles.signOutText, { color: Dawn.text.secondary }]}>Sign out</Text>
              </Pressable>
            </View>
          </View>
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
    bottom: 0,
    // set dynamically in component style to avoid static token capture
  },
  outsideTapZone: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
  },
  panelInner: {
    flex: 1,
    paddingHorizontal: PANEL_PADDING_H,
  },
  panelBody: {
    flex: 1,
  },
  menuScroll: {
    flex: 1,
  },
  menuScrollContent: {
    paddingBottom: 24,
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
    // set dynamically in component style
    letterSpacing: 0.8,
  },
  tagline: {
    fontSize: 12,
    lineHeight: 17,
    // set dynamically in component style
    opacity: 0.7,
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
    // set dynamically in component style
    fontWeight: '300',
  },
  sectionFirst: {
    marginTop: 0,
  },
  sectionAfter: {
    marginTop: SECTION_SPACING,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    // set dynamically in component style
    letterSpacing: 1.35,
    textTransform: 'uppercase',
    marginBottom: SECTION_TITLE_TO_ITEMS,
    opacity: 0.6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: 8,
  },
  navRowWithGap: {
    marginBottom: ITEM_GAP_BELOW_ROW,
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
    fontSize: 18,
    lineHeight: 22,
    opacity: 0.92,
  },
  navRowEmojiMuted: {
    opacity: 0.82,
  },
  navRowLabel: {
    fontSize: 16,
    // set dynamically in component style
    flex: 1,
  },
  signOutDivider: {
    height: 1,
    // set dynamically in component style
    marginTop: 8,
    marginBottom: SIGN_OUT_DIVIDER_MARGIN_BOTTOM,
  },
  signOutDock: {
    paddingBottom: 24,
  },
  signOutRow: {
    paddingTop: 0,
    paddingBottom: 4,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 16,
    // set dynamically in component style
    opacity: 0.72,
  },
});
