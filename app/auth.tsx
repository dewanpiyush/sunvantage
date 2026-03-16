import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
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
import supabase from '../supabase';
import { Dawn } from '../constants/theme';
import { fetchProfileCompleteness } from '../lib/profileGuard';

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) return;

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
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.gradientTop} />
            <View style={styles.gradientLowerWarm} />
          </View>
          <ScrollView
            contentContainerStyle={styles.inner}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.appName}>SunVantage</Text>
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
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="rgba(220, 218, 212, 0.6)"
                  secureTextEntry
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  style={[styles.input, passwordFocused && styles.inputFocused]}
                  returnKeyType="done"
                  onSubmitEditing={handleAuth}
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {message ? <Text style={styles.messageText}>{message}</Text> : null}

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
                  {isSignIn ? "New here? Create an account" : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
  },
  gradientTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '55%',
    backgroundColor: Dawn.background.primary,
  },
  gradientLowerWarm: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '55%',
    bottom: 0,
    backgroundColor: 'rgba(255, 179, 71, 0.058)',
  },
  flex: {
    flex: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 32,
  },
  appName: {
    fontSize: 30,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 1.4,
  },
  tagline: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 24,
    color: Dawn.text.secondary,
  },
  card: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    ...Platform.select({
      ios: {
        shadowColor: Dawn.background.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '500',
    color: Dawn.text.primary,
    lineHeight: 30,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: Dawn.text.secondary,
  },
  fieldGroup: {
    marginTop: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    color: Dawn.text.secondary,
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderRadius: 999,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    color: Dawn.text.primary,
    backgroundColor: Dawn.surface.card,
  },
  inputFocused: {
    borderColor: Dawn.accent.sunrise,
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: '#FCA5A5',
  },
  messageText: {
    marginTop: 12,
    fontSize: 13,
    color: Dawn.accent.sunrise,
  },
  button: {
    marginTop: 24,
    height: 44,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
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
    color: Dawn.text.secondary,
  },
});
