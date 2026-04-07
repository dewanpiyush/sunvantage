import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../supabase';
import { Dawn } from '../constants/theme';
import { fetchProfileCompleteness } from '../lib/profileGuard';
import posthog from '@/lib/posthog';
import PrivacyPolicyModal from '@/components/PrivacyPolicyModal';
import TermsModal from '@/components/TermsModal';

export default function AuthScreen() {
  const router = useRouter();

  // Light touch: avoid repeated identify calls while this screen is mounted.
  const identifiedUserIdRef = useRef<string | null>(null);

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) return;

        // PostHog: identify on session load (if this user hasn't been identified yet).
        try {
          const userId = session.user.id;
          const userEmail = session.user.email;
          if (posthog && identifiedUserIdRef.current !== userId) {
            identifiedUserIdRef.current = userId;
            posthog.identify(userId);
            if (userEmail && posthog.people?.set) {
              posthog.people.set({ email: userEmail });
            }
          }
        } catch {
          // ignore analytics failures
        }

        const { complete } = await fetchProfileCompleteness(supabase, session.user.id);
        router.replace((complete ? '/home' : '/onboarding') as never);
      } catch {
        // Stay on auth if anything goes wrong
      }
    };

    checkSession();
  }, [router]);

  const handleAuth = async () => {
    Keyboard.dismiss();
    if (!email || !password) {
      setError('Please enter email and password.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signUp') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          setError(normalizeError(signUpError.message));
          return;
        }

        // PostHog: identify after successful account creation (if Supabase returns a user).
        try {
          const userId = data?.user?.id;
          const userEmail = data?.user?.email ?? email;
          if (posthog && userId && identifiedUserIdRef.current !== userId) {
            identifiedUserIdRef.current = userId;
            posthog.identify(userId);
            if (userEmail && posthog.people?.set) posthog.people.set({ email: userEmail });
          }
        } catch {
          // ignore analytics failures
        }

        // PostHog: account created successfully.
        try {
          if (posthog) posthog.capture('user_signed_up');
        } catch {
          // analytics should never break auth flow
        }

        setMessage('Check your email to confirm your account.');
        router.replace('/onboarding');
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError(normalizeError(signInError.message));
          return;
        }

        if (data?.user?.id) {
          // PostHog: identify after successful login.
          try {
            const userId = data.user.id;
            const userEmail = data.user.email ?? email;
            if (posthog && identifiedUserIdRef.current !== userId) {
              identifiedUserIdRef.current = userId;
              posthog.identify(userId);
              if (userEmail && posthog.people?.set) {
                posthog.people.set({ email: userEmail });
              }
            }
          } catch {
            // ignore analytics failures
          }

          const { complete } = await fetchProfileCompleteness(supabase, data.user.id);
          router.replace((complete ? '/home' : '/onboarding') as never);
        }
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const normalizeError = (msg?: string) => {
    if (!msg) return 'Something went wrong. Please try again.';
    if (msg.toLowerCase().includes('invalid login')) {
      return 'Incorrect email or password.';
    }
    if (msg.toLowerCase().includes('already registered')) {
      return 'This email is already registered. Try signing in instead.';
    }
    return msg;
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'signIn' ? 'signUp' : 'signIn'));
    setError('');
    setMessage('');
  };

  const isSignIn = mode === 'signIn';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.flex}>
          <LinearGradient
            colors={['#102A43', '#1B3554', '#243F63']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.backgroundGradient}
            pointerEvents="none"
          />
          <ScrollView
            contentContainerStyle={styles.inner}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <Text style={styles.brandEmoji}>🌅</Text>
                <Text style={styles.appName}>SunVantage</Text>
              </View>
              <Text style={styles.tagline}>See the day differently.</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>{isSignIn ? 'Welcome back' : 'Create your account'}</Text>
              <Text style={styles.subtitle}>
                {isSignIn
                  ? 'Sign in to catch today’s sunrise with intention.'
                  : 'Sign up to start a gentle sunrise ritual.'}
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(220, 218, 212, 0.6)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={[styles.input, emailFocused && styles.inputFocused]}
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    // Move focus to password when pressing next on email
                  }}
                  blurOnSubmit={false}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor="rgba(220, 218, 212, 0.6)"
                    secureTextEntry={!passwordVisible}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    style={[styles.input, styles.inputWithRightIcon, passwordFocused && styles.inputFocused]}
                    returnKeyType="done"
                    onSubmitEditing={handleAuth}
                  />
                  <Pressable
                    onPress={() => setPasswordVisible((v) => !v)}
                    hitSlop={10}
                    style={({ pressed }) => [styles.inputRightIcon, pressed && { opacity: 0.65 }]}
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="rgba(220, 218, 212, 0.62)"
                    />
                  </Pressable>
                </View>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {message ? <Text style={styles.messageText}>{message}</Text> : null}

              {!isSignIn ? (
                <View style={styles.consentRow}>
                  <Text style={styles.consentText}>By continuing, you agree to our </Text>
                  <Pressable onPress={() => setShowTerms(true)} accessibilityRole="link">
                    <Text style={styles.consentLink}>Terms</Text>
                  </Pressable>
                  <Text style={styles.consentText}> and </Text>
                  <Pressable onPress={() => setShowPrivacy(true)} accessibilityRole="link">
                    <Text style={styles.consentLink}>Privacy Policy</Text>
                  </Pressable>
                  <Text style={styles.consentText}>.</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleAuth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Dawn.accent.sunriseOn} />
                ) : (
                  <Text style={styles.buttonText}>{isSignIn ? 'Sign in' : 'Sign up'}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleMode} style={styles.linkWrapper}>
                <Text style={styles.linkText}>
                  {isSignIn ? 'New here? ' : 'Already have an account? '}
                  <Text style={styles.linkTextAccent}>{isSignIn ? 'Create an account' : 'Sign in'}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} />
      <PrivacyPolicyModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  flex: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
    justifyContent: 'flex-start',
  },
  header: {
    // Keep a deliberate "breathing band" between identity (tagline) and the action card.
    marginBottom: 30,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandEmoji: {
    fontSize: 28, // ~93% of `appName` (30) for visual consistency.
    lineHeight: 30,
    marginRight: 9, // 8–10px spacing per design guidance
  },
  appName: {
    fontSize: 30,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 1.4,
  },
  tagline: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    color: Dawn.text.secondary,
  },
  card: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 28, // Slightly more top space after pulling the card up.
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(42, 70, 107, 0.30)',
    ...Platform.select({
      ios: {
        shadowColor: Dawn.background.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 16,
      },
      android: { elevation: 5 },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: Dawn.text.primary,
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 22,
    color: Dawn.text.secondary,
  },
  fieldGroup: {
    marginTop: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: Dawn.text.secondary,
    marginBottom: 5,
  },
  input: {
    height: 46,
    borderRadius: 999,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(42, 70, 107, 0.55)',
    color: Dawn.text.primary,
    backgroundColor: Dawn.surface.card,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputWithRightIcon: {
    paddingRight: 46,
  },
  inputRightIcon: {
    position: 'absolute',
    right: 16,
    height: 46,
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  inputFocused: {
    borderColor: 'rgba(255, 179, 71, 0.95)',
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    color: '#FCA5A5',
  },
  messageText: {
    marginTop: 10,
    fontSize: 13,
    color: Dawn.accent.sunrise,
  },
  button: {
    marginTop: 20,
    height: 42,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Dawn.background.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Dawn.accent.sunriseOn,
  },
  linkWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(175, 194, 218, 0.85)',
  },
  linkTextAccent: {
    color: 'rgba(255, 179, 71, 0.95)',
  },
  consentRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  consentText: {
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(175, 194, 218, 0.65)',
  },
  consentLink: {
    fontSize: 11,
    lineHeight: 17,
    color: 'rgba(255, 179, 71, 0.85)',
    textDecorationLine: 'underline',
  },
});
