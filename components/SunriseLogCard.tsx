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
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH_RATIO = 0.9;
const CARD_MAX_WIDTH = 420;
const CARD_MAX_HEIGHT_RATIO = 0.7; /* 70vh */
import * as ImagePicker from 'expo-image-picker';
import supabase from '../supabase';
import { clearTomorrowPlan } from '../lib/clearTomorrowPlan';
import { formatSunriseTime } from '../lib/formatSunriseTime';
import { getCurrentPosition, reverseGeocodeToPlaceName } from '../lib/location';
import { REFLECTION_PROMPT, getNextReflectionPrompt, setLastUsedReflectionPrompt } from '../lib/reflectionPrompts';
import { Dawn } from '../constants/theme';
import { useMorningContext } from '../hooks/useMorningContext';
import { getMinutesToSunrise } from '../services/weatherService';
import Ionicons from '@expo/vector-icons/Ionicons';

const photoBucket = 'sunrise_photos';
const TOTAL_STEPS = 4; /* Step 0 = pause, 1 = vantage, 2 = photo, 3 = reflection */

function normalizeVantageName(value: string | null | undefined): string | null {
  if (value == null || typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  return t === '' ? null : t;
}

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

export type SunriseLogCardProps = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onPlanForTomorrow?: () => void;
  city?: string | null;
  sunriseTime?: string | null;
  initialVantageName?: string | null;
};

export default function SunriseLogCard({
  visible,
  onClose,
  onSaved,
  onPlanForTomorrow,
  city = null,
  sunriseTime = null,
  initialVantageName = null,
}: SunriseLogCardProps) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [showMissedScreen, setShowMissedScreen] = useState(false);
  const [vantageName, setVantageName] = useState('');
  const [reflectionPrompt, setReflectionPrompt] = useState<string>(REFLECTION_PROMPT);
  const [reflectionText, setReflectionText] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string>('image/jpeg');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [detectingVantageLocation, setDetectingVantageLocation] = useState(false);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const cardTranslateY = useRef(new Animated.Value(10)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const stepOpacity = useRef(new Animated.Value(1)).current;
  const vantageInputRef = useRef<TextInput>(null);
  const reflectionInputRef = useRef<TextInput>(null);

  const cityLabel = (city && city.trim()) || 'your city';
  const sunriseLabel = formatSunriseTime(sunriseTime);
  const { sunriseTomorrow } = useMorningContext(city ?? null);
  const tomorrowSunriseLabel = formatSunriseTime(sunriseTomorrow ?? null);

  const isWithinSunriseWindow =
    sunriseTime != null &&
    typeof sunriseTime === 'string' &&
    sunriseTime.trim() !== '' &&
    Math.abs(getMinutesToSunrise(sunriseTime)) <= 60;

  // When modal opens: subtle fade + slight upward motion (150–200ms).
  useEffect(() => {
    if (visible) {
      setError('');
      setShowMissedScreen(false);
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
  }, [visible, initialVantageName, backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

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
      goToStep(0);
    } else if (step === 2) {
      goToStep(1);
    } else {
      goToStep(2);
    }
  }, [showMissedScreen, step, handleClose, goToStep]);

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
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.uri) return;
      setPhotoUri(asset.uri);
      setPhotoBase64(asset.base64 ?? null);
      setPhotoMime(asset.mimeType ?? 'image/jpeg');
    } catch {
      setError('Something went wrong choosing a photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }, []);

  const resetFormAfterSave = useCallback(() => {
    setStep(0);
    setVantageName('');
    setReflectionText('');
    setPhotoUri(null);
    setPhotoBase64(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
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
      const normalizedVantage = displayVantage ? normalizeVantageName(displayVantage) : null;
      const insertPayload: {
        user_id: string;
        created_at: string;
        vantage_name?: string;
        vantage_name_normalized?: string;
        reflection_text?: string | null;
      } = {
        user_id: userId,
        created_at: new Date().toISOString(),
      };
      if (displayVantage) {
        insertPayload.vantage_name = displayVantage;
        if (normalizedVantage) insertPayload.vantage_name_normalized = normalizedVantage;
      }
      const reflectionTrim = reflectionText.trim();
      if (reflectionTrim) insertPayload.reflection_text = reflectionTrim;

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
      if (logId != null && photoBase64 && photoUri) {
        try {
          const path = `${userId}/${logId}-${Date.now()}.jpg`;
          const binary = atob(photoBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const { error: uploadError } = await supabase.storage
            .from(photoBucket)
            .upload(path, bytes, { contentType: photoMime, upsert: true });
          if (!uploadError) {
            await supabase.from('sunrise_logs').update({ photo_url: path }).eq('id', logId);
          }
        } catch {
          // non-blocking
        }
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

      await setLastUsedReflectionPrompt(reflectionPrompt);
      resetFormAfterSave();

      // Land the moment: softly shrink + fade, then close so the page card feels like the moment landed
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(cardScale, {
          toValue: 0.92,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onSaved();
        handleClose();
      });
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [vantageName, reflectionText, reflectionPrompt, photoBase64, photoUri, photoMime, onSaved, handleClose, resetFormAfterSave, cardOpacity, cardScale]);

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
                    accessibilityLabel={showMissedScreen ? 'Back' : step === 0 ? 'Close' : 'Back'}
                  >
                    <Ionicons name="chevron-back" size={24} color={Dawn.text.primary} />
                  </Pressable>
                  <View style={styles.headerContent}>
                    {!showMissedScreen && step === 0 ? (
                      <View style={styles.headerTitleRowStep0}>
                        <Text style={styles.headerTitleEmojiLarge}>🌅</Text>
                        <Text style={[styles.headerTitleStep0, styles.headerTitleStep0Text]}>This morning</Text>
                      </View>
                    ) : (
                      <View style={styles.headerTitleRow}>
                        <Text style={styles.headerTitleEmoji}>🌅</Text>
                        <Text style={[styles.headerTitle, showMissedScreen && styles.headerTitleMissed]}>
                          {showMissedScreen ? `Tomorrow's sunrise in ${cityLabel}` : 'This morning'}
                        </Text>
                      </View>
                    )}
                    {showMissedScreen ? (
                      <Text style={styles.headerSubMissed}>{tomorrowSunriseLabel}</Text>
                    ) : step >= 1 ? (
                      <Text style={styles.headerSub}>
                        {cityLabel} — Sunrise {sunriseLabel}
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

                {/* Progress dots — only from step 1 onward; hide on missed screen */}
                {!showMissedScreen && step >= 1 ? (
                  <View style={styles.progressRow}>
                    {[0, 1, 2].map((i) => (
                      <View
                        key={i}
                        style={[
                          styles.progressDot,
                          i === step - 1 && styles.progressDotActive,
                          i < step - 1 && styles.progressDotDone,
                        ]}
                      />
                    ))}
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
                    {/* Missed screen — tomorrow's sunrise + reminder */}
                    {showMissedScreen && (
                      <View style={[styles.stepInner, styles.missedScreenContent]}>
                        <Text style={styles.missedScreenMessage}>
                          The sun will rise again tomorrow.{'\n'}Want a gentle reminder?
                        </Text>
                      </View>
                    )}
                    {/* Step 0 — witness confirmation */}
                    {!showMissedScreen && step === 0 && (
                      <Animated.View style={[styles.stepInner, styles.step0Content, { opacity: stepOpacity }]}>
                        <Text style={styles.step0Question} maxFontSizeMultiplier={1.3}>
                          Did you witness the sunrise today?
                        </Text>
                      </Animated.View>
                    )}

                    {/* Step 1 — vantage name */}
                    {!showMissedScreen && step === 1 && (
                      <Animated.View style={[styles.stepInner, { opacity: stepOpacity }]}>
                        <Text style={styles.sectionLabel}>Where were you when the light arrived today?</Text>
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
                        {isWithinSunriseWindow && (
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
                        <Text style={styles.sectionLabel}>Capture the light</Text>
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
                          <View style={styles.photoPreviewWrap}>
                            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
                            <Pressable
                              style={({ pressed }) => [styles.retakeBtn, pressed && styles.retakeBtnPressed]}
                              onPress={handleAddPhoto}
                              disabled={uploadingPhoto}
                            >
                              <Text style={styles.retakeText}>{uploadingPhoto ? 'Replacing…' : 'Retake'}</Text>
                            </Pressable>
                          </View>
                        )}
                        <Text style={styles.helper}>Some mornings deserve a frame.</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                      </Animated.View>
                    )}

                    {/* Step 3 — reflection */}
                    {!showMissedScreen && step === 3 && (
                      <Animated.View style={[styles.stepInner, { opacity: stepOpacity }]}>
                        <Text style={styles.sectionLabel}>{reflectionPrompt}</Text>
                        <TextInput
                          ref={reflectionInputRef}
                          style={styles.reflectionInput}
                          value={reflectionText}
                          onChangeText={setReflectionText}
                          placeholder="A word, a sentence, or just how it felt."
                          placeholderTextColor={Dawn.text.secondary}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                        />
                        <Text style={styles.helper}>Even a few words are enough.</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                      </Animated.View>
                    )}
                  </View>
                </ScrollView>

                {/* Fixed footer — same position for all steps */}
                <View style={[
                  styles.footer,
                  showMissedScreen && styles.footerMissed,
                  !showMissedScreen && step === 0 && styles.footerStep0,
                ]}>
                  {showMissedScreen ? (
                    <View style={[styles.footerRow, styles.footerRowStep0, styles.footerRowMissed]}>
                      <Pressable
                        style={({ pressed }) => [styles.step0SecondaryBtn, pressed && styles.btnPressed]}
                        onPress={handleClose}
                        accessibilityRole="button"
                        accessibilityLabel="Maybe later"
                      >
                        <Text style={[styles.step0SecondaryBtnText, styles.missedSecondaryBtnText]}>Maybe later</Text>
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
                  ) : step === 0 ? (
                    <View style={[styles.footerRow, styles.footerRowStep0, styles.footerRowStep0Gap]}>
                      <Pressable
                        style={({ pressed }) => [styles.step0SecondaryBtn, pressed && styles.btnPressed]}
                        onPress={() => setShowMissedScreen(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Missed it today"
                      >
                        <Text style={[styles.step0SecondaryBtnText, styles.step0SecondaryBtnTextMuted]}>Missed it today</Text>
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
                      {saving ? (
                        <ActivityIndicator color={Dawn.accent.sunriseOn} size="small" />
                      ) : (
                        <Text style={styles.saveBtnText}>Save morning</Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </Animated.View>
            </Pressable>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  headerTitleRowStep0: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitleEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  headerTitleEmojiLarge: {
    fontSize: 24,
    lineHeight: 28,
    color: Dawn.text.primary,
  },
  headerTitleStep0: {
    fontSize: 24,
    fontWeight: '600',
    color: Dawn.text.primary,
  },
  headerTitleStep0Text: {
    marginLeft: 6,
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
    marginBottom: 5,
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
  photoPreviewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    marginBottom: 8,
  },
  photoPreview: {
    width: '100%',
    height: 160,
    backgroundColor: Dawn.border.subtle,
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
