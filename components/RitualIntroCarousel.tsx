import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDawn } from '@/hooks/use-dawn';

type Slide = {
  title: string;
  line1: string;
  line2: string;
};

const SLIDES: Slide[] = [
  {
    title: '🌅  A simple morning ritual',
    line1: 'Step outside.',
    line2: 'Notice the sunrise. Stay with the moment.',
  },
  {
    title: '🌍  A ritual shared across the world',
    line1: 'The same sun,',
    line2: 'rises everywhere.',
  },
  {
    title: '✨  Make this ritual your own',
    line1: 'Wake at dawn.',
    line2: 'Witness the sunrise.',
  },
];

const NUDGE_STORAGE_KEY = 'ritual_intro_carousel_nudged_v1';
const NUDGE_DELAY_MS = 1200;
const NUDGE_DISTANCE_PX = 8;
const NUDGE_STEP_MS = 250;

export default function RitualIntroCarousel() {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const didNudgeThisMount = useRef(false);
  const isAdjustingLoop = useRef(false);
  const currentPageRef = useRef(1);
  const [activeRealIndex, setActiveRealIndex] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== cardWidth) setCardWidth(width);
  };

  const slidesLooped = useMemo(() => {
    // [cloneLast, ...realSlides, cloneFirst]
    const first = SLIDES[0];
    const last = SLIDES[SLIDES.length - 1];
    return [
      { ...last, key: 'clone_last' as const },
      ...SLIDES.map((s, idx) => ({ ...s, key: `real_${idx}` as const })),
      { ...first, key: 'clone_first' as const },
    ];
  }, []);

  const scrollToX = useCallback((x: number, animated: boolean) => {
    scrollRef.current?.scrollTo({ x, animated });
  }, []);

  // Start on the first "real" slide (index 1 in looped array).
  useEffect(() => {
    if (!scrollRef.current) return;
    if (cardWidth <= 0) return;
    requestAnimationFrame(() => {
      scrollToX(cardWidth, false);
      currentPageRef.current = 1;
    });
  }, [cardWidth, scrollToX]);

  useEffect(() => {
    if (!scrollRef.current) return;
    if (cardWidth <= 0) return;
    if (didNudgeThisMount.current) return;
    didNudgeThisMount.current = true;

    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    (async () => {
      try {
        const already = await AsyncStorage.getItem(NUDGE_STORAGE_KEY);
        if (already) return;
        if (cancelled) return;

        const baseX = cardWidth; // first real slide
        t1 = setTimeout(() => {
          scrollToX(baseX + NUDGE_DISTANCE_PX, true);
          t2 = setTimeout(() => {
            scrollToX(baseX, true);
          }, NUDGE_STEP_MS);
        }, NUDGE_DELAY_MS);

        await AsyncStorage.setItem(NUDGE_STORAGE_KEY, '1');
      } catch {
        // If storage fails, keep the nudge "best effort" and don't block UI.
        const baseX = cardWidth; // first real slide
        t1 = setTimeout(() => {
          scrollToX(baseX + NUDGE_DISTANCE_PX, true);
          t2 = setTimeout(() => {
            scrollToX(baseX, true);
          }, NUDGE_STEP_MS);
        }, NUDGE_DELAY_MS);
      }
    })();

    return () => {
      cancelled = true;
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [cardWidth, scrollToX]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (cardWidth <= 0) return;
      if (isAdjustingLoop.current) return;

      const x = e.nativeEvent.contentOffset.x;
      const page = Math.round(x / cardWidth);
      const lastRealIndexInLoop = SLIDES.length; // because looped has leading clone
      const trailingCloneIndex = SLIDES.length + 1;
      currentPageRef.current = page;

      // If user lands on leading clone (page 0), jump to last real.
      if (page === 0) {
        isAdjustingLoop.current = true;
        requestAnimationFrame(() => {
          scrollToX(lastRealIndexInLoop * cardWidth, false);
          currentPageRef.current = lastRealIndexInLoop;
          setActiveRealIndex(SLIDES.length - 1);
          isAdjustingLoop.current = false;
        });
        return;
      }

      // If user lands on trailing clone (page == SLIDES.length + 1), jump to first real.
      if (page === trailingCloneIndex) {
        isAdjustingLoop.current = true;
        requestAnimationFrame(() => {
          scrollToX(cardWidth, false);
          currentPageRef.current = 1;
          setActiveRealIndex(0);
          isAdjustingLoop.current = false;
        });
        return;
      }
      setActiveRealIndex(Math.max(0, Math.min(SLIDES.length - 1, page - 1)));
    },
    [cardWidth, scrollToX]
  );

  const handleArrowPress = useCallback(() => {
    if (cardWidth <= 0) return;
    const nextPage = currentPageRef.current + 1;
    scrollToX(nextPage * cardWidth, true);
  }, [cardWidth, scrollToX]);

  return (
    <View style={styles.card} onLayout={onLayout}>
      <ScrollView
        ref={(r) => {
          scrollRef.current = r;
        }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {slidesLooped.map((slide) => (
          <View key={slide.key} style={[styles.slide, cardWidth > 0 ? { width: cardWidth } : null]}>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.bodyLine}>{slide.line1}</Text>
            <Text style={[styles.bodyLine, styles.bodyLineSecond]}>{slide.line2}</Text>
          </View>
        ))}
      </ScrollView>
      <Pressable
        style={({ pressed }) => [styles.peekArrowHitbox, pressed && styles.peekArrowPressed]}
        onPress={handleArrowPress}
        accessibilityRole="button"
        accessibilityLabel="Next ritual slide"
      >
        <Text style={styles.peekArrow}>→</Text>
      </Pressable>
      <View style={styles.dotsRow} pointerEvents="none">
        {SLIDES.map((_, idx) => (
          <View key={`dot_${idx}`} style={[styles.dot, idx === activeRealIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
    card: {
      backgroundColor: Dawn.surface.card,
      borderRadius: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: Platform.OS === 'android' ? 'rgba(255,255,255,0.06)' : Dawn.border.soft,
      overflow: 'hidden',
    },
    slide: {
      paddingVertical: 16,
      paddingHorizontal: 18,
      paddingBottom: 30,
      alignSelf: 'flex-start',
      alignItems: 'center',
      justifyContent: 'center',
    },
    peekArrow: {
      fontSize: 18,
      lineHeight: 18,
      fontWeight: '600',
      color: Dawn.text.secondary,
      opacity: 0.4,
    },
    peekArrowHitbox: {
      position: 'absolute',
      right: 6,
      top: '50%',
      transform: [{ translateY: -16 }],
      width: 28,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    peekArrowPressed: {
      opacity: 0.72,
    },
    dotsRow: {
      position: 'absolute',
      bottom: 10,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 99,
      backgroundColor: Dawn.text.secondary,
      opacity: 0.28,
    },
    dotActive: {
      width: 5,
      height: 5,
      opacity: 0.7,
      backgroundColor: Dawn.accent.sunrise,
    },
    title: {
      fontSize: 17,
      lineHeight: 21,
      fontWeight: '600',
      color: Dawn.text.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    bodyLine: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
      color: Dawn.text.secondary,
      textAlign: 'center',
    },
    bodyLineSecond: {
      marginTop: 6,
    },
  });
}

