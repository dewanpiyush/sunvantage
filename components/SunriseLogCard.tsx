import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Dimensions,
  ScrollView,
  InteractionManager,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH_RATIO = 0.9;
const CARD_MAX_WIDTH = 420;
const CARD_MAX_HEIGHT_RATIO = 0.7; /* 70vh */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import supabase from '../supabase';
import { clearTomorrowPlan } from '../lib/clearTomorrowPlan';
import { formatSunriseTime } from '../lib/formatSunriseTime';
import { getCurrentPosition, reverseGeocodeToPlaceName } from '../lib/location';
import { REFLECTION_PROMPT, getNextReflectionPrompt, setLastUsedReflectionPrompt } from '../lib/reflectionPrompts';
import { normalizeVantageForStorage } from '../lib/vantageUtils';
import { useDawn } from '@/hooks/use-dawn';
import { useMorningContext } from '../hooks/useMorningContext';
import { getMinutesToSunriseForCity, getCoordinatesForCity } from '../services/weatherService';
import { invokeModerateImage } from '../lib/moderateImageInvoke';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import posthog from '@/lib/posthog';

const photoBucket = 'sunrise_photos';

/** Aligned with `isSunriseWindow` on Today's Sunrise screen (presence / present-tense modal). */
const MODAL_LIVE_WINDOW_MIN = 20;
/** Optional "use current location" while still plausibly near the witness window. */
const USE_LOCATION_WINDOW_MIN = 60;

const LOG_MODAL_COPY = {
  live: {
    step1: 'Where are you as the light arrives?',
    step2: 'Capture this moment, if you want.',
    step3: 'What is staying with you?',
    reflectionPlaceholder: 'A word, a sentence, or just how it feels.',
  },
  retro: {
    step0: 'Did you welcome the sunrise today?',
    step1: 'Where were you when the light arrived?',
    step2: 'Did you capture the sunrise today?',
    step3: 'What stayed with you today?',
    reflectionPlaceholder: 'A word, a sentence, or just how it felt.',
  },
  pre: {
    step1: 'Where will you be when the light arrives?',
    step2: 'Capture this morning, if you can.',
    step3: 'What is on your mind before dawn?',
    reflectionPlaceholder: 'A word, a sentence, or a quiet intention.',
  },
} as const;

function getTodayLocalDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

async function fetchStreakFromRpc(): Promise<{ current: number; longest: number; lastDate: string | null } | null> {
  const tz = getDeviceTimezone();
  const { data, error } = await supabase.rpc('get_my_streak', { p_timezone: tz });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const current =
    typeof r.current_streak === 'number'
      ? r.current_streak
      : typeof r.current_streak === 'string'
        ? parseInt(r.current_streak, 10)
        : 0;
  const longest =
    typeof r.longest_streak === 'number'
      ? r.longest_streak
      : typeof r.longest_streak === 'string'
        ? parseInt(r.longest_streak, 10)
        : 0;
  const lastDate = getTodayLocalDateString();
  return {
    current: Number.isNaN(current) ? 0 : current,
    longest: Number.isNaN(longest) ? 0 : Math.max(longest, current),
    lastDate,
  };
}

/** Emitted as soon as the sunrise_logs row exists; heavy work continues in the background. */
export type SunriseLogSaveResult = {
  logId: number;
  reflectionText: string;
  vantageName: string;
  localPhotoUri?: string;
};

export type SunriseLogCardProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: (result: SunriseLogSaveResult) => void;
  onModerationComplete?: () => void;
  onPlanForTomorrow?: () => void;
  city?: string | null;
  sunriseTime?: string | null;
  initialVantageName?: string | null;
  source?: 'home' | 'explorer' | 'other';
};

export default function SunriseLogCard({
  visible,
  onClose,
  onSaved,
  onModerationComplete,
  onPlanForTomorrow,
  city = null,
  sunriseTime = null,
  initialVantageName = null,
  source = 'other',
}: SunriseLogCardProps) {
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(1);
  const [showMissedScreen, setShowMissedScreen] = useState(false);
  const [vantageName, setVantageName] = useState('');
  const [reflectionPrompt, setReflectionPrompt] = useState<string>(REFLECTION_PROMPT);
  const [reflectionText, setReflectionText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/jpeg');
  const [saving, setSaving] = useState(false);
  const [saveStage, setSaveStage] = useState<'idle' | 'saved' | 'processing'>('idle');
  const [error, setError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const processingOpacity = useRef(new Animated.Value(0.85)).current;
  const processingLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [detectingVantageLocation, setDetectingVantageLocation] = useState(false);
  const [overrideCoords, setOverrideCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const cardTranslateY = useRef(new Animated.Value(10)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const vantageInputRef = useRef<TextInput>(null);
  const reflectionInputRef = useRef<TextInput>(null);

  const cityLabel = (city && city.trim()) || 'your city';
  const sunriseLabel = formatSunriseTime(sunriseTime);
  const { sunriseTomorrow, cityTimezone } = useMorningContext(city ?? null);
  const tomorrowSunriseLabel = formatSunriseTime(sunriseTomorrow ?? null);

  const minutesToSunriseCity = React.useMemo(
    () => getMinutesToSunriseForCity(sunriseTime, cityTimezone),
    [sunriseTime, cityTimezone]
  );

  const isLiveSunriseWindow =
    minutesToSunriseCity != null &&
    minutesToSunriseCity >= -MODAL_LIVE_WINDOW_MIN &&
    minutesToSunriseCity <= MODAL_LIVE_WINDOW_MIN;

  const logModalTone: keyof typeof LOG_MODAL_COPY = React.useMemo(() => {
    const m = minutesToSunriseCity;
    if (m != null && m >= -MODAL_LIVE_WINDOW_MIN && m <= MODAL_LIVE_WINDOW_MIN) return 'live';
    if (m != null && m < -MODAL_LIVE_WINDOW_MIN) return 'retro';
    return 'pre';
  }, [minutesToSunriseCity]);

  const logCopy = LOG_MODAL_COPY[logModalTone];
  /** Opening confirmation — retrospective logging only (live / pre start at step 1). */
  const hasRetroStep0 = logModalTone === 'retro';

  const showUseCurrentLocation =
    minutesToSunriseCity != null &&
    Math.abs(minutesToSunriseCity) <= USE_LOCATION_WINDOW_MIN;

  const sunriseLogStartedFiredRef = useRef(false);

  // When modal opens: subtle fade + slight upward motion (150–200ms).
  useEffect(() => {
    if (visible) {
      setError('');
      setSaveStage('idle');
      setShowMissedScreen(false);
      setStep(logModalTone === 'retro' ? 0 : 1);
      if (vantageName === '' && initialVantageName?.trim()) {
        setVantageName(initialVantageName.trim());
      }
      getNextReflectionPrompt().then(setReflectionPrompt);
      cardOpacity.setValue(0);
      cardScale.setValue(0.96);
      cardTranslateY.setValue(10);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      cardOpacity.setValue(0);
      cardScale.setValue(0.96);
      cardTranslateY.setValue(10);
    }
  }, [visible, initialVantageName, logModalTone, backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  // PostHog: fire once per modal open.
  useEffect(() => {
    if (!visible) {
      sunriseLogStartedFiredRef.current = false;
      return;
    }
    if (sunriseLogStartedFiredRef.current) return;
    sunriseLogStartedFiredRef.current = true;
    try {
      if (posthog) posthog.capture('sunrise_log_started', { source });
    } catch {
      // ignore analytics errors
    }
  }, [visible, source]);

  // Android-safe visibility fallback: if entry animation is interrupted,
  // ensure the modal content still renders in a visible state.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      backdropOpacity.setValue(1);
      cardOpacity.setValue(1);
      cardScale.setValue(1);
      cardTranslateY.setValue(0);
    }, 260);
    return () => clearTimeout(t);
  }, [visible, backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  // Focus vantage input when moving to step 1.
  useEffect(() => {
    if (visible && step === 1) {
      const t = setTimeout(() => vantageInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [visible, step]);

  // Focus reflection input when moving to step 3.
  useEffect(() => {
    if (visible && step === 3) {
      const t = setTimeout(() => reflectionInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [visible, step]);

  // While processing: run a subtle fade for the processing copy.
  useEffect(() => {
    if (saveStage !== 'processing') {
      processingOpacity.setValue(0.85);
      processingLoopRef.current?.stop?.();
      processingLoopRef.current = null;
      return;
    }

    processingLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(processingOpacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(processingOpacity, {
          toValue: 0.85,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    processingLoopRef.current.start();
    return () => processingLoopRef.current?.stop?.();
  }, [saveStage, processingOpacity]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.96,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 10,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose, backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const goToStep = useCallback((next: 0 | 1 | 2 | 3) => {
    Animated.timing(stepOpacity, {
      toValue: 0,
      duration: 120,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      setError('');
      Animated.timing(stepOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  }, [stepOpacity]);

  const handleBack = useCallback(() => {
    if (showMissedScreen) {
      setShowMissedScreen(false);
      return;
    }
    if (step === 0) {
      handleClose();
    } else if (step === 1) {
      if (hasRetroStep0) goToStep(0);
      else handleClose();
    } else if (step === 2) {
      goToStep(1);
    } else {
      goToStep(2);
    }
  }, [showMissedScreen, step, hasRetroStep0, handleClose, goToStep]);

  const handleContinueFromStep0 = useCallback(() => {
    goToStep(1);
  }, [goToStep]);

  const handleContinueFromStep1 = useCallback(() => {
    goToStep(2);
  }, [goToStep]);

  const handleSkipFromStep1 = useCallback(() => {
    goToStep(2);
  }, [goToStep]);

  const handleContinueFromStep2 = useCallback(() => {
    goToStep(3);
  }, [goToStep]);

  const handleSkipFromStep2 = useCallback(() => {
    goToStep(3);
  }, [goToStep]);

  const handleUseCurrentLocation = useCallback(async () => {
    setError('');
    setDetectingVantageLocation(true);
    try {
      const coords = await getCurrentPosition();
      if (!coords) {
        setError('Location access was denied or unavailable.');
        return;
      }
      setOverrideCoords(coords);
      const placeName = await reverseGeocodeToPlaceName(coords.latitude, coords.longitude);
      if (placeName) {
        setVantageName(placeName);
      } else {
        setError('We couldn’t determine a place name. Please type it in.');
      }
    } catch {
      setError('Something went wrong. Please enter the place name manually.');
    } finally {
      setDetectingVantageLocation(false);
    }
  }, []);

  const handleAddPhoto = useCallback(async () => {
    try {
      setUploadingPhoto(true);
      setError('');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('We need permission to access your photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.6,
        base64: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.uri) return;
      let processedUri = asset.uri;
      let processedMime = asset.mimeType ?? 'image/jpeg';
      try {
        const resized = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1080 } }],
          {
            compress: 0.6,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );
        if (resized?.uri) {
          processedUri = resized.uri;
          processedMime = 'image/jpeg';
        }
      } catch {
        // Fallback to original pick; keep flow resilient if manipulation fails.
      }
      setPhotoUri(processedUri);
      setPhotoMime(processedMime);
    } catch {
      setError('Something went wrong choosing a photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }, []);

  const resetFormAfterSave = useCallback(() => {
    setStep(logModalTone === 'retro' ? 0 : 1);
    setVantageName('');
    setReflectionText('');
    setPhotoUri(null);
    setOverrideCoords(null);
  }, [logModalTone]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveStage('idle');
    setError('');
    let didSucceed = false;
    const createdAt = new Date().toISOString();
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      let userId: string | undefined = session?.user?.id;
      if (!userId) {
        const { data: userData } = await supabase.auth.getUser();
        userId = userData?.user?.id;
      }
      if (!userId) {
        setError('We could not find your account. Please sign in again.');
        return;
      }
      const displayVantage = vantageName.trim() || null;
      const vantageNorm = displayVantage ? normalizeVantageForStorage(displayVantage) : null;

      // City-level dot: store one lat/lng per city on each log.
      // Prefer override coords (if the user allowed location), then profile coords, then default geocode for city.
      const profileRes = await supabase
        .from('profiles')
        .select('city, latitude, longitude')
        .eq('user_id', userId)
        .maybeSingle();
      const profile = profileRes.data as { city?: string | null; latitude?: number | null; longitude?: number | null } | null;
      const resolvedCity = (profile?.city?.trim() || (city && city.trim()) || '');
      let lat =
        overrideCoords?.latitude ??
        (typeof profile?.latitude === 'number' ? profile?.latitude : null);
      let lng =
        overrideCoords?.longitude ??
        (typeof profile?.longitude === 'number' ? profile?.longitude : null);
      if (
        resolvedCity &&
        (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng))
      ) {
        const geo = await getCoordinatesForCity(resolvedCity, { userId, supabase });
        lat = geo?.latitude ?? null;
        lng = geo?.longitude ?? null;
      }

      const insertPayload: {
        user_id: string;
        created_at: string;
        sunrise_day?: string;
        city?: string;
        latitude?: number;
        longitude?: number;
        vantage_name?: string;
        vantage_name_normalized?: string;
        user_input_vantage?: string;
        normalized_vantage?: string;
        vantage_category?: string;
        reflection_text?: string | null;
        moderation_status?: 'pending';
      } = {
        user_id: userId,
        created_at: createdAt,
        sunrise_day: getTodayLocalDateString(),
      };
      if (resolvedCity) insertPayload.city = resolvedCity;
      if (lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        insertPayload.latitude = lat;
        insertPayload.longitude = lng;
      }
      if (vantageNorm != null && vantageNorm.userInputVantage !== '') {
        insertPayload.vantage_name = vantageNorm.userInputVantage;
        insertPayload.user_input_vantage = vantageNorm.userInputVantage;
        if (vantageNorm.normalizedVantage != null) {
          insertPayload.vantage_name_normalized = vantageNorm.normalizedVantage;
          insertPayload.normalized_vantage = vantageNorm.normalizedVantage;
        }
        insertPayload.vantage_category = vantageNorm.vantageCategory;
      }
      const reflectionTrim = reflectionText.trim();
      if (reflectionTrim) insertPayload.reflection_text = reflectionTrim;
      // Do not set moderation_status here when a photo will be uploaded — it is set only after storage upload succeeds.

      const { data: insertData, error: insertError } = await supabase
        .from('sunrise_logs')
        .insert(insertPayload)
        .select('id')
        .limit(1);

      if (insertError) {
        setError(insertError.message || "We couldn't save this morning. Please try again.");
        return;
      }

      const logId = insertData?.[0]?.id as number | undefined;
      if (logId == null) {
        setError("We couldn't save this morning. Please try again.");
        return;
      }

      const capturedPhotoUri = photoUri;
      const capturedMime = photoMime;
      const capturedReflectionPrompt = reflectionPrompt;
      const capturedVantage = vantageName.trim();
      const capturedReflection = reflectionTrim;

      didSucceed = true;
      const hasPhoto = Boolean(capturedPhotoUri);
      // PostHog: flow completed successfully.
      try {
        if (posthog) {
          posthog.capture('sunrise_log_completed', { has_photo: hasPhoto, source });
        }
      } catch {
        // ignore
      }
      setSaving(false);
      setSaveStage('idle');
      resetFormAfterSave();

      onClose();
      onSaved({
        logId,
        reflectionText: capturedReflection,
        vantageName: capturedVantage,
        localPhotoUri: capturedPhotoUri ?? undefined,
      });

      const runBackgroundPipeline = () => void (async () => {
        try {
          if (capturedPhotoUri) {
            const stagedPath = `${userId}/${logId}-${Date.now()}.jpg`;
            const savedPendingPhotoRef = `uploads_pending/${stagedPath}`;
            const fileResponse = await fetch(capturedPhotoUri);
            const fileBuffer = await fileResponse.arrayBuffer();

            const { error: uploadError } = await supabase.storage
              .from('uploads_pending')
              .upload(stagedPath, fileBuffer, { contentType: capturedMime, upsert: true });
            if (uploadError) {
              console.warn('[SunVantage] pending upload failed (background)', {
                logId,
                stagedPath,
                message: uploadError.message,
              });
              return;
            }

            // PostHog: photo upload succeeded (after the storage upload completes).
            try {
              if (posthog) posthog.capture('photo_uploaded');
            } catch {
              // ignore
            }

            const { error: dbErr } = await supabase
              .from('sunrise_logs')
              .update({ photo_url: savedPendingPhotoRef, moderation_status: 'pending' })
              .eq('id', logId)
              .eq('user_id', userId);
            if (dbErr) {
              console.warn('[SunVantage] could not save pending photo ref (background)', dbErr);
              return;
            }

            void invokeModerateImage(supabase, {
              path: stagedPath,
              type: 'sunrise',
              logId,
            }).then(({ data, error: invokeError }) => {
              if (invokeError) {
                console.warn('[SunVantage] moderate-image invoke failed', {
                  logId,
                  stagedPath,
                  message: invokeError.message,
                });
                return;
              }
              const status = (data as { status?: string } | null)?.status;
              if (status !== 'approved' && status !== 'rejected') {
                console.warn('[SunVantage] moderate-image unexpected response', {
                  logId,
                  stagedPath,
                  data,
                });
                return;
              }
              onModerationComplete?.();
            });
          }

          await clearTomorrowPlan();
          const fromRpc = await fetchStreakFromRpc();
          const newCurrent = fromRpc?.current ?? 0;
          const newLongest = fromRpc?.longest ?? 0;
          const lastDate = fromRpc?.lastDate ?? getTodayLocalDateString();
          await supabase
            .from('profiles')
            .update({
              current_streak: newCurrent,
              longest_streak: newLongest,
              last_witness_date: lastDate,
            })
            .eq('user_id', userId);

          await setLastUsedReflectionPrompt(capturedReflectionPrompt);
        } catch (e) {
          console.warn('[SunVantage] save background pipeline', e);
        }
      })();
      InteractionManager.runAfterInteractions(runBackgroundPipeline);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      if (!didSucceed) {
        setSaving(false);
        setSaveStage('idle');
      }
    }
  }, [vantageName, reflectionText, reflectionPrompt, photoUri, photoMime, onSaved, onClose, resetFormAfterSave, onModerationComplete, city, overrideCoords, source]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalRoot}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.45],
                }),
              },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>

          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          >
            <Pressable onPress={() => {}} style={styles.cardWrap}>
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: cardOpacity,
                    transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
                  },
                ]}
              >
                <View style={styles.headerGlow} pointerEvents="none" />
                {showMissedScreen ? (
                  <View style={styles.missedHeaderGlow} pointerEvents="none" />
                ) : null}

                <View style={styles.header}>
                  <Pressable
                    style={({ pressed }) => [styles.backBtn, pressed && styles.dismissBtnPressed]}
                    onPress={handleBack}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showMissedScreen
                        ? 'Back'
                        : step === 0
                          ? 'Close'
                          : step === 1 && !hasRetroStep0
                            ? 'Close'
                            : 'Back'
                    }
                  >
                    <Ionicons name="chevron-back" size={24} color={Dawn.text.primary} />
                  </Pressable>
                  <View style={styles.headerContent}>
                    {showMissedScreen ? (
                      <View style={styles.headerTitleRow}>
                        <Text style={styles.headerTitleEmoji}>🌅</Text>
                        <View style={styles.headerTitleAndTime}>
                          <Text style={[styles.headerTitle, styles.headerTitleMissed]}>
                            Tomorrow{"'"}s sunrise in {cityLabel}
                          </Text>
                          <Text style={styles.headerSubMissed}>{tomorrowSunriseLabel}</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.headerTitleRow}>
                        <Text style={styles.headerTitleEmoji}>🌅</Text>
                        <Text style={styles.headerTitle}>This morning</Text>
                      </View>
                    )}
                    {!showMissedScreen && step >= 1 ? (
                      <Text style={styles.headerSub}>
                        {cityLabel} — Sunrise {sunriseLabel}{isLiveSunriseWindow ? ' · Now' : ''}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.dismissBtn,
                      pressed && styles.dismissBtnPressed,
                    ]}
                    onPress={handleClose}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Text style={styles.dismissIcon}>×</Text>
                  </Pressable>
                </View>

                {/* Progress dots — only for steps 1→2→3; hidden on step 0 and on missed screen. */}
                {!showMissedScreen && step >= 1 ? (
                  <View style={styles.progressRow}>
                    {Array.from({ length: 3 }, (_, i) => {
                      const activeIndex = step - 1;
                      return (
                        <View
                          key={i}
                          style={[
                            styles.progressDot,
                            i === activeIndex && styles.progressDotActive,
                            i < activeIndex && styles.progressDotDone,
                          ]}
                        />
                      );
                    })}
                  </View>
                ) : null}

                {/* stepContent: content-driven height, scrolls only when needed */}
                <ScrollView
                  style={styles.scrollView}
                  contentContainerStyle={styles.scrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.stepContent}>
                    {saveStage !== 'idle' ? (
                      <Animated.View style={[styles.stepInner, styles.processingContent, { opacity: processingOpacity }]}>
                        {saveStage === 'saved' ? (
                          <>
                            <Text style={styles.processingSaved}>✓ Saved</Text>
                            <Text style={styles.processingTitle}>Your morning is part of today</Text>
                          </>
                        ) : (
                          <>
                            <ActivityIndicator color={Dawn.text.secondary} size="small" />
                            <Text style={styles.processingTitle}>
                              Adding your morning to today{"'"}s global sunrise map
                            </Text>
                          </>
                        )}
                      </Animated.View>
                    ) : (
                    <>
                    {/* Missed screen — tomorrow's sunrise + reminder */}
                    {showMissedScreen && (
                      <View style={[styles.stepInner, styles.missedScreenContent]}>
                        <Text style={styles.missedScreenMessage}>
                          Set a gentle reminder before the light arrives.
                        </Text>
                      </View>
                    )}
                    {/* Step 0 — retrospective only: witness confirmation */}
                    {!showMissedScreen && step === 0 && hasRetroStep0 && (
                      <Animated.View style={[styles.stepInner, styles.step0Content, { opacity: stepOpacity }]}>
                        <Text style={styles.step0Question} maxFontSizeMultiplier={1.3}>
                          {LOG_MODAL_COPY.retro.step0}
                        </Text>
                      </Animated.View>
                    )}
                    {/* Step 1 — vantage name */}
                    {!showMissedScreen && step === 1 && (
                      <Animated.View style={[styles.stepInner, { opacity: stepOpacity }]}>
                        <Text style={styles.sectionLabel}>{logCopy.step1}</Text>
                        <TextInput
                          ref={vantageInputRef}
                          style={styles.vantageInput}
                          value={vantageName}
                          onChangeText={setVantageName}
                          placeholder="Name this place"
                          placeholderTextColor={Dawn.text.secondary}
                          autoCapitalize="words"
                          returnKeyType="done"
                        />
                        {showUseCurrentLocation && (
                          <Pressable
                            style={({ pressed }) => [
                              styles.useLocationBtn,
                              pressed && styles.btnPressed,
                              detectingVantageLocation && styles.useLocationBtnDisabled,
                            ]}
                            onPress={handleUseCurrentLocation}
                            disabled={detectingVantageLocation}
                          >
                            {detectingVantageLocation ? (
                              <ActivityIndicator color={Dawn.text.secondary} size="small" />
                            ) : (
                              <Text style={styles.useLocationBtnText}>Use current location</Text>
                            )}
                          </Pressable>
                        )}
                        <Text style={styles.helper}>Every vantage reveals the light differently.</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                      </Animated.View>
                    )}

                    {/* Step 2 — photo */}
                    {!showMissedScreen && step === 2 && (
                      <Animated.View style={[styles.stepInner, { opacity: stepOpacity }]}>
                        <Text style={styles.sectionLabel}>{logCopy.step2}</Text>
                        {!photoUri ? (
                          <Pressable
                            style={({ pressed }) => [styles.addPhotoBtn, pressed && styles.addPhotoBtnPressed]}
                            onPress={handleAddPhoto}
                            disabled={uploadingPhoto}
                          >
                            {uploadingPhoto ? (
                              <ActivityIndicator color={Dawn.text.primary} size="small" />
                            ) : (
                              <Text style={styles.addPhotoText}>+ Add photo</Text>
                            )}
                          </Pressable>
                        ) : (
                          <>
                            <View style={styles.photoPreviewClip}>
                              <Image source={{ uri: photoUri }} style={styles.photoPreviewImage} contentFit="cover" transition={200} />
                            </View>
                            <Pressable
                              style={({ pressed }) => [styles.retakeBtn, pressed && styles.retakeBtnPressed]}
                              onPress={handleAddPhoto}
                              disabled={uploadingPhoto}
                            >
                              <Text style={styles.retakeText}>
                                {uploadingPhoto
                                  ? 'Replacing…'
                                  : 'Pick another'}
                              </Text>
                            </Pressable>
                          </>
                        )}
                        <Text style={styles.helper}>Some mornings deserve a frame.</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                      </Animated.View>
                    )}

                    {/* Step 3 — reflection */}
                    {!showMissedScreen && step === 3 && (
                      <Animated.View style={[styles.stepInner, { opacity: stepOpacity }]}>
                        <Text style={styles.sectionLabel}>{logCopy.step3}</Text>
                        <TextInput
                          ref={reflectionInputRef}
                          style={styles.reflectionInput}
                          value={reflectionText}
                          onChangeText={setReflectionText}
                          placeholder={logCopy.reflectionPlaceholder}
                          placeholderTextColor={Dawn.text.secondary}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                        />
                        <Text style={styles.helper}>Even a few words are enough.</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                      </Animated.View>
                    )}
                    </>
                    )}
                  </View>
                </ScrollView>

                {/* Fixed footer — same position for all steps */}
                {saveStage === 'idle' ? (
                <View style={[
                  styles.footer,
                  showMissedScreen && styles.footerMissed,
                ]}>
                  {showMissedScreen ? (
                    <View style={[styles.footerRow, styles.footerRowStep0, styles.footerRowMissed]}>
                      <Pressable
                        style={({ pressed }) => [styles.step0SecondaryBtn, pressed && styles.btnPressed]}
                        onPress={handleClose}
                        accessibilityRole="button"
                        accessibilityLabel="Not now"
                      >
                        <Text style={[styles.step0SecondaryBtnText, styles.missedSecondaryBtnText]}>Not now</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.primaryBtn, styles.primaryBtnMissed, pressed && styles.btnPressed]}
                        onPress={() => {
                          onPlanForTomorrow?.();
                          handleClose();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Plan for tomorrow"
                      >
                        <Text style={styles.primaryBtnText}>Plan for tomorrow</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {step === 0 && hasRetroStep0 ? (
                    <View style={[styles.footerRow, styles.footerRowStep0, styles.footerRowStep0Gap, styles.footerStep0]}>
                      <Pressable
                        style={({ pressed }) => [styles.step0SecondaryBtn, pressed && styles.btnPressed]}
                        onPress={() => setShowMissedScreen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Not today"
                      >
                        <Text style={[styles.step0SecondaryBtnText, styles.step0SecondaryBtnTextMuted]}>Not today</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.primaryBtn, styles.primaryBtnStep0, pressed && styles.btnPressed]}
                        onPress={handleContinueFromStep0}
                        accessibilityRole="button"
                        accessibilityLabel="Yes, I did"
                      >
                        <Text style={styles.primaryBtnText}>Yes, I did</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {step === 1 ? (
                    <View style={styles.footerRow}>
                      <Pressable
                        style={({ pressed }) => [styles.skipBtn, pressed && styles.btnPressed]}
                        onPress={handleSkipFromStep1}
                      >
                        <Text style={styles.skipBtnText}>Skip for now</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                        onPress={handleContinueFromStep1}
                      >
                        <Text style={styles.primaryBtnText}>Continue</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {step === 2 ? (
                    <View style={styles.footerRow}>
                      <Pressable
                        style={({ pressed }) => [styles.skipBtn, pressed && styles.btnPressed]}
                        onPress={handleSkipFromStep2}
                      >
                        <Text style={styles.skipBtnText}>Skip for now</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
                        onPress={handleContinueFromStep2}
                      >
                        <Text style={styles.primaryBtnText}>Continue</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {step === 3 ? (
                    <Pressable
                      style={({ pressed }) => [
                        styles.saveBtn,
                        saving && styles.saveBtnDisabled,
                        pressed && !saving && styles.saveBtnPressed,
                      ]}
                      onPress={handleSave}
                      disabled={saving}
                    >
                      <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save morning'}</Text>
                    </Pressable>
                  ) : null}
                </View>
                ) : null}
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  cardWrap: {
    width: SCREEN_WIDTH * CARD_WIDTH_RATIO,
    maxWidth: CARD_MAX_WIDTH,
    maxHeight: SCREEN_HEIGHT * CARD_MAX_HEIGHT_RATIO,
    alignSelf: 'center',
  },
  card: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * CARD_MAX_HEIGHT_RATIO,
    flexDirection: 'column',
    backgroundColor: Dawn.surface.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    overflow: 'hidden',
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * CARD_MAX_HEIGHT_RATIO * 0.55,
  },
  scrollContent: {
    flexGrow: 0,
  },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Dawn.border.subtle,
    backgroundColor: Dawn.surface.card,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.secondary,
  },
  btnPressed: {
    opacity: 0.85,
  },
  headerGlow: {
    position: 'absolute',
    top: -20,
    left: '10%',
    right: '10%',
    height: 60,
    borderRadius: 999,
    backgroundColor: 'rgba(255,179,71,0.07)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleAndTime: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerTitleEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 2,
  },
  headerTitleMissed: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 0,
  },
  headerSub: {
    fontSize: 15,
    color: Dawn.text.secondary,
  },
  headerSubMissed: {
    fontSize: 14,
    color: Dawn.text.primary,
    opacity: 0.8,
    marginTop: 0,
  },
  missedHeaderGlow: {
    position: 'absolute',
    top: -40,
    left: '5%',
    right: '5%',
    height: 120,
    borderRadius: 999,
    backgroundColor: 'rgba(255,179,71,0.06)',
  },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissBtnPressed: {
    opacity: 0.85,
  },
  dismissIcon: {
    fontSize: 24,
    lineHeight: 28,
    color: Dawn.text.primary,
    opacity: 0.7,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingBottom: 20,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Dawn.border.subtle,
  },
  progressDotActive: {
    backgroundColor: Dawn.accent.sunrise,
    transform: [{ scale: 1.2 }],
  },
  progressDotDone: {
    backgroundColor: Dawn.accent.sunrise,
    opacity: 0.6,
  },
  missedScreenContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 32,
  },
  missedScreenMessage: {
    fontSize: 17,
    color: Dawn.text.primary,
    textAlign: 'center',
    lineHeight: 28,
  },
  step0Content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingBottom: 12,
  },
  step0Question: {
    fontSize: 18,
    fontWeight: '600',
    color: Dawn.text.primary,
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 280,
  },
  footerRowStep0: {
    justifyContent: 'space-between',
  },
  footerRowStep0Gap: {
    gap: 16,
  },
  footerStep0: {
    paddingTop: 8,
  },
  step0SecondaryBtnTextMuted: {
    opacity: 0.72,
  },
  primaryBtnStep0: {
    paddingVertical: 10,
    backgroundColor: 'rgba(255,179,71,0.88)',
  },
  footerRowMissed: {
    gap: 16,
  },
  footerMissed: {
    paddingTop: 28,
  },
  missedSecondaryBtnText: {
    opacity: 0.7,
  },
  primaryBtnMissed: {
    opacity: 0.92,
  },
  step0SecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  step0SecondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.secondary,
  },
  useLocationBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  useLocationBtnDisabled: {
    opacity: 0.6,
  },
  useLocationBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: Dawn.text.secondary,
  },
  stepInner: {
    paddingBottom: 4,
  },
  processingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 10,
  },
  processingSaved: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(74, 222, 128, 0.95)',
    textAlign: 'center',
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.text.primary,
    textAlign: 'center',
    marginBottom: 0,
  },
  processingHelper: {
    fontSize: 13,
    color: Dawn.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: Dawn.text.primary,
    marginBottom: 12,
  },
  vantageInput: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    backgroundColor: Dawn.background.primary,
    color: Dawn.text.primary,
    fontSize: 16,
    marginBottom: 8,
  },
  reflectionInput: {
    minHeight: 88,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    backgroundColor: Dawn.background.primary,
    color: Dawn.text.primary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  helper: {
    fontSize: 12,
    color: Dawn.text.secondary,
    fontStyle: 'italic',
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: Dawn.text.secondary,
  },
  primaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
  },
  primaryBtnFull: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Dawn.accent.sunriseOn,
  },
  addPhotoBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Dawn.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    maxHeight: 120,
    marginBottom: 8,
  },
  addPhotoBtnPressed: {
    opacity: 0.85,
  },
  addPhotoText: {
    fontSize: 15,
    color: Dawn.text.secondary,
  },
  /** Photo selected: minimal clip only (no background/border); image fills width. */
  photoPreviewClip: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  retakeBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  retakeBtnPressed: {
    opacity: 0.8,
  },
  retakeText: {
    fontSize: 13,
    color: Dawn.text.secondary,
  },
  errorText: {
    fontSize: 13,
    color: '#FCA5A5',
    marginBottom: 12,
    textAlign: 'center',
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: Dawn.accent.sunrise,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnPressed: {
    opacity: 0.9,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.accent.sunriseOn,
  },
  });
}
