import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../supabase';
import { Dawn } from '../constants/theme';
import { useMorningContext } from '../hooks/useMorningContext';
import { getCurrentPosition, reverseGeocodeToCity } from '../lib/location';

/** Format "HH:mm" as "h:mm AM/PM" for display. */
function formatSunriseTime(hhmm: string | null): string {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm ?? '—';
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr!, 10);
  const m = mStr!;
  const ampm = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [error, setError] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [cityFocused, setCityFocused] = useState(false);

  const cityForSunrise = city.trim().length >= 2 ? city.trim() : null;
  const { sunriseTomorrow, loading: sunriseLoading } = useMorningContext(cityForSunrise);
  const displaySunriseTime = formatSunriseTime(sunriseTomorrow ?? null);

  const handleStep1Continue = () => {
    const name = firstName.trim();
    if (!name) {
      setError('Please enter what we should call you.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleDetectLocation = async () => {
    setError('');
    setDetectingLocation(true);
    try {
      const coords = await getCurrentPosition();
      if (!coords) {
        setError('Location access was denied or unavailable.');
        return;
      }
      const cityName = await reverseGeocodeToCity(coords.latitude, coords.longitude);
      if (cityName) {
        setCity(cityName);
      } else {
        setError('We couldn’t determine your city. Please enter it manually.');
      }
    } catch {
      setError('Something went wrong. Please try entering your city manually.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleSubmit = async () => {
    const name = firstName.trim();
    const cityTrimmed = city.trim();
    if (!name || !cityTrimmed) {
      setError('Please enter your name and where your mornings begin.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      let userId: string | undefined = session?.user?.id;
      let authError = sessionError ?? null;

      if (!userId) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        authError = authError ?? userError ?? null;
        userId = userData?.user?.id;
      }

      if (authError || !userId) {
        setError('Unable to find your account. Please sign in again.');
        return;
      }

      const { error: insertError } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: userId,
            first_name: name,
            city: cityTrimmed,
          },
          { onConflict: 'user_id' }
        );

      if (insertError) {
        setError(insertError.message || 'We could not save your details. Please try again.');
        return;
      }

      try {
        await AsyncStorage.setItem('sunvantage_open_nav_once', '1');
      } catch {
        // ignore non-critical onboarding affordance flag failure
      }
      router.replace('/home' as never);
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const progressLabel = step === 1 ? 'Step 1 of 2' : 'Step 2 of 2';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.gradientTop} />
        <View style={styles.gradientLowerWarm} />
      </View>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={styles.appName}>SunVantage</Text>
          <Text style={styles.tagline}>See the day differently.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.progress}>{progressLabel}</Text>

          {step === 1 ? (
            <>
              <Text style={styles.prompt}>What should we call you?</Text>
              <Text style={styles.subtext}>Your mornings will greet you by name.</Text>
              <View style={styles.fieldGroup}>
                <TextInput
                  value={firstName}
                  onChangeText={(t) => {
                    setFirstName(t);
                    setError('');
                  }}
                  placeholder="Alex"
                  placeholderTextColor="rgba(220, 218, 212, 0.6)"
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  style={[styles.input, nameFocused && styles.inputFocused]}
                  autoCapitalize="words"
                />
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.button, (!firstName.trim() && styles.buttonDisabled) as object]}
                onPress={handleStep1Continue}
                disabled={!firstName.trim()}
              >
                <Text style={styles.buttonText}>Continue</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.prompt}>Where will you usually watch the sunrise from?</Text>
              <TouchableOpacity
                style={[styles.useLocationLink, detectingLocation && styles.useLocationLinkDisabled]}
                onPress={handleDetectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <ActivityIndicator color={Dawn.text.secondary} size="small" />
                ) : (
                  <Text style={styles.useLocationLinkText}>📍 Use my current location</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.helperLocation}>Used only to show sunrise times. You can change it anytime.</Text>
              <Text style={styles.orEnterCity}>or enter city</Text>
              <View style={styles.fieldGroupCity}>
                <TextInput
                  value={city}
                  onChangeText={(t) => {
                    setCity(t);
                    setError('');
                  }}
                  placeholder="Lisbon"
                  placeholderTextColor="rgba(220, 218, 212, 0.6)"
                  onFocus={() => setCityFocused(true)}
                  onBlur={() => setCityFocused(false)}
                  style={[styles.input, cityFocused && styles.inputFocused]}
                  autoCapitalize="words"
                />
              </View>
              {cityForSunrise && (
                <View style={styles.sunrisePreview}>
                  {sunriseLoading ? (
                    <ActivityIndicator size="small" color={Dawn.accent.sunrise} />
                  ) : (
                    <Text style={styles.sunrisePreviewText}>
                      Sunrise tomorrow in {cityTrimmedDisplay(city)}: {displaySunriseTime}
                    </Text>
                  )}
                </View>
              )}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <TouchableOpacity
                style={[styles.button, styles.buttonBegin, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={Dawn.accent.sunriseOn} />
                ) : (
                  <Text style={styles.buttonText}>Begin</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backLink}
                onPress={() => {
                  setError('');
                  setStep(1);
                }}
              >
                <Text style={styles.backLinkText}>Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function cityTrimmedDisplay(city: string): string {
  const t = city.trim();
  return t || 'your city';
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
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
  },
  appName: {
    fontSize: 30,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 1.4,
  },
  tagline: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 23,
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
  progress: {
    fontSize: 13,
    fontWeight: '500',
    color: Dawn.text.secondary,
    marginBottom: 20,
    letterSpacing: 0.4,
  },
  prompt: {
    fontSize: 22,
    fontWeight: '500',
    color: Dawn.text.primary,
    lineHeight: 30,
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: Dawn.text.secondary,
  },
  fieldGroup: {
    marginTop: 20,
  },
  fieldGroupCity: {
    marginTop: 18,
  },
  input: {
    height: 46,
    borderRadius: 999,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    color: Dawn.text.primary,
    backgroundColor: Dawn.surface.card,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: Dawn.accent.sunrise,
  },
  sunrisePreview: {
    marginTop: 16,
    minHeight: 24,
    justifyContent: 'center',
  },
  sunrisePreviewText: {
    fontSize: 14,
    lineHeight: 22,
    color: Dawn.accent.sunrise,
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    color: '#FCA5A5',
  },
  button: {
    marginTop: 28,
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
    opacity: 0.6,
  },
  buttonBegin: {
    backgroundColor: 'rgba(255, 179, 71, 0.88)',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Dawn.accent.sunriseOn,
  },
  backLink: {
    marginTop: 16,
    alignSelf: 'center',
  },
  backLinkText: {
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  useLocationLink: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    borderRadius: 999,
  },
  useLocationLinkDisabled: {
    opacity: 0.6,
  },
  useLocationLinkText: {
    fontSize: 14,
    fontWeight: '500',
    color: Dawn.text.secondary,
  },
  orEnterCity: {
    marginTop: 22,
    fontSize: 12,
    color: Dawn.text.secondary,
    opacity: 0.85,
  },
  helperLocation: {
    marginTop: 8,
    fontSize: 12,
    color: Dawn.text.secondary,
    lineHeight: 18,
  },
});
