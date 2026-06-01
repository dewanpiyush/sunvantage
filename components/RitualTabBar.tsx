import React, { useCallback, useMemo } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  RitualTabBarDock,
  RITUAL_TAB_ORDER,
  ritualTabKeyFromRouteName,
  type RitualTabKey,
} from '@/components/RitualTabBarDock';

export default function RitualTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const activeTab = useMemo((): RitualTabKey => {
    const route = state.routes[state.index];
    const key = route ? ritualTabKeyFromRouteName(route.name) : null;
    return key ?? 'today';
  }, [state.index, state.routes]);

  const accessibilityLabels = useMemo(() => {
    const labels: Partial<Record<RitualTabKey, string>> = {};
    for (const key of RITUAL_TAB_ORDER) {
      const index = state.routes.findIndex((r) => ritualTabKeyFromRouteName(r.name) === key);
      if (index < 0) continue;
      const route = state.routes[index];
      const label = descriptors[route.key]?.options?.tabBarAccessibilityLabel;
      if (typeof label === 'string') labels[key] = label;
    }
    return labels;
  }, [descriptors, state.routes]);

  const onTabPress = useCallback(
    (key: RitualTabKey) => {
      const index = state.routes.findIndex((r) => ritualTabKeyFromRouteName(r.name) === key);
      if (index < 0) return;
      const route = state.routes[index];
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (state.index !== index && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    },
    [navigation, state.index, state.routes]
  );

  return (
    <RitualTabBarDock
      activeTab={activeTab}
      onTabPress={onTabPress}
      accessibilityLabels={accessibilityLabels}
    />
  );
}
