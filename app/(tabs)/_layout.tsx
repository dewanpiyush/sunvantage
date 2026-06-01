import { Tabs } from 'expo-router';
import React from 'react';
import RitualTabBar from '@/components/RitualTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <RitualTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 0,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarLabel: 'Today',
        }}
      />
      <Tabs.Screen
        name="tomorrow"
        options={{
          title: 'Tomorrow',
          tabBarLabel: 'Tomorrow',
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Community',
          tabBarLabel: 'Community',
        }}
      />
      <Tabs.Screen
        name="you"
        options={{
          title: 'You',
          tabBarLabel: 'You',
        }}
      />
    </Tabs>
  );
}
