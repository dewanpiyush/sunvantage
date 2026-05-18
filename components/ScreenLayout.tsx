import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Extra scroll range when content is shorter than the viewport (calm drag, not a large bounce). */
const SHORT_CONTENT_SCROLL_OVERSHOOT = 72;

type ScreenLayoutProps = {
  header: React.ReactNode;
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  headerContainerStyle?: StyleProp<ViewStyle>;
  scrollContentContainerStyle?: StyleProp<ViewStyle>;
  scrollStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  /** Bottom padding inside ScrollView content (breathing room below last card). */
  contentBreathingRoom?: number;
  /** Allow a small vertical drag + overscroll when content does not naturally overflow. */
  enableGentleScrollWhenShort?: boolean;
};

export default function ScreenLayout({
  header,
  children,
  containerStyle,
  headerContainerStyle,
  scrollContentContainerStyle,
  scrollStyle,
  showsVerticalScrollIndicator = false,
  contentBreathingRoom,
  enableGentleScrollWhenShort = false,
}: ScreenLayoutProps) {
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);

  const bottomPadding = contentBreathingRoom ?? styles.scrollContent.paddingBottom;

  return (
    <SafeAreaView style={[styles.safeArea, containerStyle]} edges={['top']}>
      <View style={styles.root}>
        <View style={[styles.headerContainer, headerContainerStyle]}>{header}</View>
        <ScrollView
          style={[styles.scroll, scrollStyle]}
          contentContainerStyle={[
            styles.scrollContent,
            { flexGrow: 1, paddingBottom: bottomPadding },
            enableGentleScrollWhenShort &&
              scrollViewportHeight > 0 && {
                minHeight: scrollViewportHeight + SHORT_CONTENT_SCROLL_OVERSHOOT,
              },
            scrollContentContainerStyle,
          ]}
          onLayout={
            enableGentleScrollWhenShort
              ? (e) => setScrollViewportHeight(e.nativeEvent.layout.height)
              : undefined
          }
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
          alwaysBounceVertical={enableGentleScrollWhenShort}
          bounces={enableGentleScrollWhenShort}
          overScrollMode={enableGentleScrollWhenShort ? 'always' : 'auto'}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
});
