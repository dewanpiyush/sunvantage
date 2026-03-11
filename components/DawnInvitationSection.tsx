/**
 * Dawn Invitation section shown after a sunrise is logged.
 * Tap CTA → invite card appears (scale + fade) → Share or dismiss (× / tap outside).
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
  Modal,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Dawn } from '@/constants/theme';
import { formatSunriseTime } from '@/lib/formatSunriseTime';
import { buildDawnInviteLink, getTomorrowLocalYmd } from '@/lib/inviteLink';
import DawnInviteShareCard from './DawnInviteShareCard';
import DawnInvitationNudgeCard from './DawnInvitationNudgeCard';

export type DawnInvitationSectionProps = {
  city: string | null | undefined;
  sunriseTomorrow: string | null;
};

function getShareMessage(city: string | null | undefined, sunriseTomorrow: string | null) {
  const displayCity = city?.trim() || 'Your city';
  const sunriseHHmm = sunriseTomorrow ?? '—';
  const formattedTime = formatSunriseTime(sunriseTomorrow);
  const dateYmd = getTomorrowLocalYmd();
  const link =
    sunriseTomorrow && /^\d{1,2}:\d{2}$/.test(sunriseTomorrow)
      ? buildDawnInviteLink({ city: displayCity, sunriseHHmm, dateYmd })
      : `https://sunvantage.app/invite?city=${encodeURIComponent(displayCity)}&date=${encodeURIComponent(dateYmd)}`;
  return `Tomorrow's sunrise in ${displayCity} is at ${formattedTime}.\n\nI'll be there at dawn.\nJoin me in greeting the first light.\n\n${link}`;
}

export default function DawnInvitationSection({
  city,
  sunriseTomorrow,
}: DawnInvitationSectionProps) {
  const [showCardModal, setShowCardModal] = useState(false);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(10);
  const cardScale = useSharedValue(0.96);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    translateY.value = withTiming(0, { duration: 300 });
  }, [opacity, translateY]);

  useEffect(() => {
    if (showCardModal) {
      cardScale.value = 0.96;
      cardOpacity.value = 0;
      cardScale.value = withTiming(1, { duration: 220 });
      cardOpacity.value = withTiming(1, { duration: 220 });
    }
  }, [showCardModal, cardScale, cardOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const openCard = () => setShowCardModal(true);
  const closeCard = () => setShowCardModal(false);

  const handleShare = () => {
    const message = getShareMessage(city, sunriseTomorrow);
    Share.share({
      message,
      title: 'Dawn invitation',
    })
      .then(() => {
        closeCard();
      })
      .catch(() => {
        closeCard();
      });
  };

  const formattedTime = formatSunriseTime(sunriseTomorrow);
  const displayCity = city?.trim() || 'Your city';

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <DawnInvitationNudgeCard onPress={openCard} />

      <Modal
        visible={showCardModal}
        transparent
        animationType="fade"
        onRequestClose={closeCard}
        statusBarTranslucent
      >
        <Pressable style={styles.modalBackdrop} onPress={closeCard}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Animated.View style={[styles.cardWrap, cardAnimatedStyle]}>
              <DawnInviteShareCard
                city={displayCity}
                sunriseTimeFormatted={formattedTime}
                onShare={handleShare}
                onDismiss={closeCard}
                interactive
              />
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
    alignItems: 'stretch',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    alignItems: 'center',
  },
  cardWrap: {
    width: '100%',
  },
});
