import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDawn } from '@/hooks/use-dawn';
import BottomSheetModal from '@/components/BottomSheetModal';

export type TermsModalProps = {
  visible: boolean;
  onClose: () => void;
};

function EmailLink({ email }: { email: string }) {
  const Dawn = useDawn();
  return (
    <Pressable onPress={() => Linking.openURL(`mailto:${email}`)} accessibilityRole="link">
      <Text style={[styles.link, { color: Dawn.accent.sunrise }]}>{email}</Text>
    </Pressable>
  );
}

export default function TermsModal({ visible, onClose }: TermsModalProps) {
  const Dawn = useDawn();
  return (
    <BottomSheetModal visible={visible} onClose={onClose} heightRatio={0.85}>
      <View style={[styles.header, { borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
        <Text style={[styles.title, { color: Dawn.text.primary }]}>Terms of Service</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={[styles.close, { color: Dawn.text.secondary }]}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: Dawn.text.secondary }]}>We’ve kept this simple.</Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>1. Using the app</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          SunVantage is a personal app designed to help you build a sunrise ritual.{'\n\n'}
          You agree to use the app responsibly and not misuse it.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>2. Your content</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          You own the content you create (photos, reflections).{'\n\n'}
          By uploading content, you allow us to display it within the app experience, including optional public galleries.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>3. Moderation</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          We may remove or restrict content that violates basic safety standards.{'\n\n'}
          This does not affect your access to your own personal logs.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>4. Availability</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          We aim to keep SunVantage running smoothly, but we cannot guarantee uninterrupted service.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>5. Liability</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          SunVantage is provided “as is” without warranties.{'\n\n'}
          We are not liable for any losses resulting from your use of the app.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>6. Changes</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          We may update these terms from time to time.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>7. Governing law</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          These terms are governed by the laws of India.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>8. Contact</Text>
        <EmailLink email="support@sunvantage.app" />
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  close: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '300',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  intro: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  link: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

