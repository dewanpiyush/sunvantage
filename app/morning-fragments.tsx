import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import SunVantageHeader from '@/components/SunVantageHeader';
import MorningFragmentCard from '@/components/MorningFragmentCard';
import { useDawn } from '@/hooks/use-dawn';
import {
  getUnlockedMorningFragments,
  MORNING_FRAGMENTS,
  type MorningFragment,
} from '@/lib/morningFragments';

export default function MorningFragmentsScreen() {
  const router = useRouter();
  const Dawn = useDawn();
  const styles = useMemo(() => makeStyles(Dawn), [Dawn]);
  const [cards, setCards] = useState<MorningFragment[]>([]);

  const totalFragmentsAvailable = MORNING_FRAGMENTS.length;
  const showClosingLine =
    cards.length >= 1 && cards.length < totalFragmentsAvailable;

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
            cards.length > 0 && !showClosingLine && styles.scrollContentWhenComplete,
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
          </View>
          {showClosingLine ? (
            <Text style={styles.closingLine}>There is more to notice.</Text>
          ) : null}
        </ScrollView>
      )}
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
    /** Extra end padding when the list shows all fragments (no closing line). */
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
    /** Continuity cue — only when some but not all fragments are visible. */
    closingLine: {
      alignSelf: 'center',
      width: '90%',
      marginTop: 36,
      marginBottom: 56,
      paddingHorizontal: 8,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: '400',
      textAlign: 'center',
      color: Dawn.text.primary,
      opacity: 0.66,
    },
  });
}

