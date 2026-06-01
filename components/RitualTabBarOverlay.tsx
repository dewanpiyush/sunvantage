import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { RitualTabBarDock, type RitualTabKey } from '@/components/RitualTabBarDock';
import { ROUTES } from '@/lib/routes';

const TAB_ROUTE: Record<RitualTabKey, string> = {
  today: ROUTES.today,
  tomorrow: ROUTES.tomorrow,
  community: ROUTES.community,
  you: ROUTES.you,
};

export type RitualTabBarOverlayProps = {
  /** Which tab appears selected while on a stack screen (default Today). */
  activeTab?: RitualTabKey;
};

/**
 * Floating ritual dock on root stack screens (Witness, Vantage) after logging —
 * same chrome as the main tab bar, routes into `/(tabs)/*`.
 */
export default function RitualTabBarOverlay({ activeTab = 'today' }: RitualTabBarOverlayProps) {
  const router = useRouter();

  const onTabPress = useCallback(
    (tab: RitualTabKey) => {
      if (tab === activeTab) {
        router.navigate(TAB_ROUTE[tab] as never);
        return;
      }
      router.push(TAB_ROUTE[tab] as never);
    },
    [activeTab, router]
  );

  return <RitualTabBarDock activeTab={activeTab} onTabPress={onTabPress} />;
}
