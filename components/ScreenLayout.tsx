import React from 'react';
import { View, ScrollView, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScreenLayoutProps = {
  header: React.ReactNode;
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  headerContainerStyle?: StyleProp<ViewStyle>;
  scrollContentContainerStyle?: StyleProp<ViewStyle>;
  scrollStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
};

export default function ScreenLayout({
  header,
  children,
  containerStyle,
  headerContainerStyle,
  scrollContentContainerStyle,
  scrollStyle,
  showsVerticalScrollIndicator = false,
}: ScreenLayoutProps) {
  return (
    <SafeAreaView style={[styles.safeArea, containerStyle]} edges={['top']}>
      <View style={styles.root}>
        <View style={[styles.headerContainer, headerContainerStyle]}>{header}</View>
        <ScrollView
          style={[styles.scroll, scrollStyle]}
          contentContainerStyle={[styles.scrollContent, scrollContentContainerStyle]}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
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
