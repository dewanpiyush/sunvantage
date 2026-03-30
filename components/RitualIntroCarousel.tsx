import React, { useState } from 'react';
import { LayoutChangeEvent, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
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
    line2: 'Notice the sunrise. Mark the moment.',
  },
  {
    title: '🌍  Shared across the world',
    line1: 'The same sun,',
    line2: 'witnessed everywhere.',
  },
  {
    title: '✨  Make it your own',
    line1: 'Return each day,',
    line2: 'in your own way.',
  },
];

const CARD_WIDTH_RATIO = 0.92;
const HORIZONTAL_PEEK_PADDING = 20;
const CARD_GAP = 12;

export default function RitualIntroCarousel() {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const [cardWidth, setCardWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.round(event.nativeEvent.layout.width);
    if (width > 0 && width !== cardWidth) setCardWidth(width);
  };
  const slideWidth = cardWidth > 0 ? Math.round(cardWidth * CARD_WIDTH_RATIO) : 0;
  const snapInterval = slideWidth > 0 ? slideWidth + CARD_GAP : undefined;

  return (
    <View style={styles.card} onLayout={onLayout}>
      <ScrollView
        horizontal
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        showsHorizontalScrollIndicator={false}
        bounces={false}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
      >
        {SLIDES.map((slide, index) => (
          <View
            key={slide.title}
            style={[
              styles.slide,
              slideWidth > 0 ? { width: slideWidth } : null,
              index < SLIDES.length - 1 ? styles.slideGap : null,
            ]}
          >
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.bodyLine}>{slide.line1}</Text>
            <Text style={[styles.bodyLine, styles.bodyLineSecond]}>{slide.line2}</Text>
          </View>
        ))}
      </ScrollView>
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
    scrollContent: {
      alignItems: 'stretch',
      paddingHorizontal: HORIZONTAL_PEEK_PADDING,
    },
    slide: {
      paddingVertical: 16,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slideGap: {
      marginRight: CARD_GAP,
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

