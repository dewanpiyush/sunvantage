import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import SunVantageHeader from '@/components/SunVantageHeader';
import MorningFragmentCard from '@/components/MorningFragmentCard';
import ContributeFragmentSheet from '@/components/ContributeFragmentSheet';
import { useDawn } from '@/hooks/use-dawn';
import {
  CURATED_MORNING_FRAGMENT_COUNT,
  getUnlockedMorningFragments,
  type MorningFragment,
} from '@/lib/morningFragments';

export default function MorningFragmentsScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const styles = useMemo(() => makeStyles(Dawn), [Dawn]);
  const [cards, setCards] = useState<MorningFragment[]>([]);
  const [showContributeSheet, setShowContributeSheet] = useState(false);

  const isCuratedCollectionComplete = cards.length >= CURATED_MORNING_FRAGMENT_COUNT;

  const loadCards = useCallback(async () => {
    const unlocked = await getUnlockedMorningFragments();
    setCards(unlocked);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadCards();
    }, [loadCards])
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <SunVantageHeader
          showBack
          hideMenu
          showBranding
          onBackPress={() => router.back()}
          title="Morning Fragments"
          subtitle="Observations from cultures, science, and history."
          screenTitle={false}
          subtitleStyle={styles.subtitleOverride}
        />
      </View>

      {cards.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Nothing here yet.</Text>
          <Text style={styles.emptyBody}>Spend a few mornings, and something will appear.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            cards.length > 0 && isCuratedCollectionComplete && styles.scrollContentWhenComplete,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            {cards.map((card) => (
              <MorningFragmentCard
                key={card.id}
                title={card.title}
                body={card.body}
                illustrationType={card.illustrationType}
              />
            ))}
            <View style={styles.contributionBreak} />
            <Pressable
              style={({ pressed }) => [
                styles.contributionCard,
                pressed && styles.contributionCardPressed,
              ]}
              onPress={() => setShowContributeSheet(true)}
            >
              <View style={styles.contributionTitleRow}>
                <View style={styles.contributionGlyph} aria-hidden>
                  <View style={styles.contributionGlyphLine} />
                  <View style={styles.contributionGlyphSun} />
                </View>
                <Text style={styles.contributionTitle}>From where you are</Text>
              </View>
              <Text style={styles.contributionBody}>
                Morning is understood differently across places and cultures. If there is a way your
                community has known or greeted it, you can add to this shared record.
              </Text>
              <Text style={styles.contributionCta}>Add a fragment -&gt;</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
      <ContributeFragmentSheet
        visible={showContributeSheet}
        onClose={() => setShowContributeSheet(false)}
      />
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Dawn.background.primary,
      paddingTop: 52,
    },
    headerWrap: {
      paddingHorizontal: 24,
      marginBottom: 8,
    },
    subtitleOverride: {
      opacity: 0.72,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 16,
      paddingTop: 8,
    },
    /** Extra end padding when the curated set is fully visible. */
    scrollContentWhenComplete: {
      paddingBottom: 48,
    },
    column: {
      width: '90%',
      alignSelf: 'center',
      gap: 18,
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    emptyTitle: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '500',
      color: Dawn.text.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
      color: Dawn.text.secondary,
      textAlign: 'center',
      opacity: 0.86,
    },
    contributionCard: {
      marginTop: 28,
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderRadius: 15,
      paddingTop: 18,
      paddingHorizontal: 20,
      paddingBottom: 18,
      shadowColor: '#AFC4E5',
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    contributionCardPressed: {
      opacity: 0.8,
    },
    contributionTitle: {
      fontSize: 11.5,
      lineHeight: 16,
      fontWeight: '600',
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      color: Dawn.text.secondary,
      opacity: 0.82,
    },
    contributionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    contributionGlyph: {
      width: 16,
      height: 10,
      justifyContent: 'center',
      opacity: 0.68,
    },
    contributionGlyphLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 6,
      borderTopWidth: 1,
      borderTopColor: Dawn.text.secondary,
      opacity: 0.55,
    },
    contributionGlyphSun: {
      position: 'absolute',
      right: 1,
      top: 2,
      width: 4,
      height: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Dawn.text.secondary,
      opacity: 0.75,
    },
    contributionBody: {
      fontSize: 14.5,
      lineHeight: 22,
      color: Dawn.text.primary,
      opacity: 0.86,
    },
    contributionCta: {
      marginTop: 14,
      fontSize: 13.5,
      lineHeight: 19,
      fontWeight: '600',
      color: Dawn.text.primary,
      opacity: 0.9,
    },
    contributionBreak: {
      alignSelf: 'center',
      width: '44%',
      marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: Dawn.border.subtle,
      opacity: 0.26,
    },
  });
}

