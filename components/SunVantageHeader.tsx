import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import supabase from '../supabase';
import { Dawn } from '../constants/theme';

type Props = {
  showBack?: boolean;
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** When true, first menu item is "Today's sunrise"; when false, "Log today's sunrise". Both route to /witness. */
  hasLoggedToday?: boolean;
  /** When true, only show back (← Home), title, subtitle; no SunVantage dropdown. */
  hideMenu?: boolean;
  /** When true with hideMenu, show the large "SunVantage" branding text (no chevron). */
  showBranding?: boolean;
  /** When true, show "My City's Sunrises" in the chevron menu (only if there are other users' photos in the same city). */
  showMyCitySunrises?: boolean;
  /** Override bottom margin of the header wrapper (e.g. 0 for tighter layout when scroll content has its own padding). */
  wrapperMarginBottom?: number;
};

export default function SunVantageHeader({ showBack, title, subtitle, children, hasLoggedToday = false, hideMenu = false, showBranding = false, showMyCitySunrises = false, wrapperMarginBottom }: Props) {
  const router = useRouter();
  const [menuVisible, setMenuVisible] = useState(false);

  const firstMenuItemLabel = hasLoggedToday ? "Today's sunrise" : "Log today's sunrise";
  const firstMenuItemRoute = '/witness';

  const handleSignOut = async () => {
    setMenuVisible(false);
    await supabase.auth.signOut();
    router.replace('/auth' as never);
  };

  const wrapperStyle = wrapperMarginBottom !== undefined ? [styles.wrapper, { marginBottom: wrapperMarginBottom }] : styles.wrapper;

  return (
    <>
      <View style={wrapperStyle}>
        {showBack && (
          <Pressable
            style={({ pressed }) => [styles.backControl, pressed && { opacity: 0.72 }]}
            onPress={() => router.push('/home')}
          >
            <Text style={styles.backControlText}>{hideMenu ? '← Home' : '‹ SunVantage Home'}</Text>
          </Pressable>
        )}
        {!hideMenu && (
          <Pressable
            style={({ pressed }) => [styles.headerRow, pressed && { opacity: 0.78 }]}
            onPress={() => setMenuVisible(true)}
          >
            <Text style={styles.appName}>SunVantage</Text>
            <View style={[styles.chevronWrap, { transform: [{ rotate: menuVisible ? '90deg' : '0deg' }] }]}>
              <Ionicons name="chevron-forward" size={18} color={Dawn.text.secondary} />
            </View>
          </Pressable>
        )}
        {hideMenu && showBranding ? <Text style={styles.appName}>SunVantage</Text> : null}
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>

      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <View style={styles.menuDragIndicator} />
            <Pressable
              style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.78 }]}
              onPress={() => { setMenuVisible(false); router.push(firstMenuItemRoute as never); }}
            >
              <Text style={styles.menuOptionText}>{firstMenuItemLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.78 }]}
              onPress={() => { setMenuVisible(false); router.push('/tomorrow-plan' as never); }}
            >
              <Text style={styles.menuOptionText}>Tomorrow's plan</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.78 }]}
              onPress={() => { setMenuVisible(false); router.push('/my-mornings'); }}
            >
              <Text style={styles.menuOptionText}>My Mornings</Text>
            </Pressable>
            {showMyCitySunrises ? (
              <Pressable
                style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.78 }]}
                onPress={() => { setMenuVisible(false); router.push('/my-city-sunrises'); }}
              >
                <Text style={styles.menuOptionText}>My City's Sunrises</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.78 }]}
              onPress={() => { setMenuVisible(false); router.push('/ritual-markers'); }}
            >
              <Text style={styles.menuOptionText}>My Ritual Markers</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.78 }]}
              onPress={() => { setMenuVisible(false); router.push('/profile'); }}
            >
              <Text style={styles.menuOptionText}>My Profile</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.menuOption, pressed && { opacity: 0.78 }]}
              onPress={handleSignOut}
            >
              <Text style={styles.menuOptionText}>Sign out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  backControl: {
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backControlText: {
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 0.8,
  },
  chevronWrap: {
    marginLeft: 6,
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 0.8,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 34, 61, 0.6)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: Dawn.background.primary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  menuDragIndicator: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Dawn.border.subtle,
    marginBottom: 16,
  },
  menuOption: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  menuOptionText: {
    fontSize: 17,
    color: Dawn.text.primary,
  },
});
