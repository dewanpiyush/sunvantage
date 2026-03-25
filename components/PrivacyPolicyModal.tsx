import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDawn } from '@/hooks/use-dawn';
import BottomSheetModal from '@/components/BottomSheetModal';

export type PrivacyPolicyModalProps = {
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

export default function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  const Dawn = useDawn();
  return (
    <BottomSheetModal visible={visible} onClose={onClose} heightRatio={0.85}>
      <View style={[styles.header, { borderBottomColor: 'rgba(255,255,255,0.06)' }]}>
        <Text style={[styles.title, { color: Dawn.text.primary }]}>Privacy Policy</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={[styles.close, { color: Dawn.text.secondary }]}>×</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: Dawn.text.secondary }]}>This is how we handle your data.</Text>

        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          SunVantage is designed to be a quiet, personal space. We collect only what is needed to make the app work.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>1. What we collect</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          • Your email address (to create your account){'\n'}
          • Your sunrise logs (photos, reflections, and locations you choose to save){'\n'}
          • Basic technical data to keep the app reliable{'\n\n'}
          We do not collect unnecessary personal data.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>2. How we use your data</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          We use your data to:{'\n'}
          • Save and show your personal sunrise history{'\n'}
          • Enable core app features{'\n'}
          • Improve stability and performance{'\n\n'}
          We do not sell your data.{'\n'}
          We do not use your data for advertising.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>3. Photos and visibility</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          • Your sunrise photos are saved privately first{'\n'}
          • Public galleries only show content that passes basic moderation{'\n'}
          • Your personal logs are always available to you
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>4. Your control</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          You can:{'\n'}
          • Delete your data at any time{'\n'}
          • Stop using the app whenever you choose{'\n\n'}
          For deletion requests, contact: <EmailLink email="privacy@sunvantage.app" />
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>5. Data security</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          We take reasonable steps to protect your data, but no system is completely secure.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>6. Children</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          You must be at least 13 years old to use SunVantage.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>7. Changes</Text>
        <Text style={[styles.body, { color: Dawn.text.secondary }]}>
          We may update this policy from time to time.
        </Text>

        <Text style={[styles.sectionTitle, { color: Dawn.text.primary }]}>8. Contact</Text>
        <EmailLink email="privacy@sunvantage.app" />

        <Text style={[styles.footer, { color: Dawn.text.secondary }]}>
          SunVantage is built to be private-first and non-performative.
        </Text>
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
  footer: {
    marginTop: 18,
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
    opacity: 0.9,
  },
});

