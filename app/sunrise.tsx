import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Animated, Easing } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../supabase';
import { clearTomorrowPlan } from '../lib/clearTomorrowPlan';
import { getWitnessSubheading } from '../lib/ritualState';
import { useMorningContext } from '../hooks/useMorningContext';
import { useDawn } from '@/hooks/use-dawn';
import { useAppTheme } from '@/context/AppThemeContext';
import SunVantageHeader from '../components/SunVantageHeader';
import SunriseLogCard from '../components/SunriseLogCard';
import StreakBlock from '../components/StreakBlock';
import RitualRevealCard from '../components/RitualRevealCard';
import SharedDawnPreview from '../components/SharedDawnPreview';
import DawnInvitationSection from '../components/DawnInvitationSection';
import { computeBadgeStats, getEarnedBadges, computeEarnedAtByBadge, type BadgeDef } from './ritual-markers';
import { dismissBadgeReveal } from '../lib/ritualReveal';
import { BADGE_ICONS } from './ritual-markers';
import { normalizeVantageForStorage, getNormalizedVantageFromRow } from '../lib/vantageUtils';
import { getCoordinatesForCity } from '../services/weatherService';
import { invokeModerateImage } from '../lib/moderateImageInvoke';

const REFLECTION_PROMPTS = [
  'What are you grateful for this morning?',
  'What feels quietly good right now?',
  'What did you notice that you might have missed?',
  'What feels steady in your life today?',
  'Who or what made this morning possible?',
  'What small thing deserves appreciation?',
  'What are you carrying forward from yesterday?',
  'What feels lighter after stepping outside?',
  'What did the sky remind you of?',
  'What are you thankful for — even if it\'s ordinary?',
  'What part of today feels full of possibility?',
  'What feels enough, just as it is?',
  'What are you choosing to begin again with today?',
  'What deserves your attention today?',
  'What feels quietly hopeful?',
];

function getDailyPrompt() {
  const d = new Date();
  const daySeed = d.getFullYear() + d.getMonth() + d.getDate();
  return REFLECTION_PROMPTS[daySeed % REFLECTION_PROMPTS.length];
}

const REFLECTION_INVITATIONS = [
  'What stayed with you?',
  'What small thing deserves appreciation?',
];

const LAST_REFLECTION_PROMPT_KEY = 'sunvantage_last_reflection_prompt_id';
const LAST_REFLECTION_PROMPT_DATE_KEY = 'sunvantage_last_reflection_prompt_date';

async function getReflectionInvitationAsync(): Promise<string> {
  const today = getTodayLocalDateString();
  const yesterday = getYesterdayLocalDateString();
  try {
    const [lastIdRaw, lastDate] = await Promise.all([
      AsyncStorage.getItem(LAST_REFLECTION_PROMPT_KEY),
      AsyncStorage.getItem(LAST_REFLECTION_PROMPT_DATE_KEY),
    ]);
    const lastId = lastIdRaw != null ? parseInt(lastIdRaw, 10) : null;
    if (lastDate === today && lastId != null && !Number.isNaN(lastId) && lastId >= 0 && lastId < REFLECTION_INVITATIONS.length) {
      return REFLECTION_INVITATIONS[lastId];
    }
    const excludeId =
      lastDate === yesterday && lastId != null && !Number.isNaN(lastId) ? lastId : null;
    const candidates =
      excludeId == null
        ? [...REFLECTION_INVITATIONS]
        : REFLECTION_INVITATIONS.filter((_, i) => i !== excludeId);
    const pool = candidates.length > 0 ? candidates : REFLECTION_INVITATIONS;
    const prompt = pool[Math.floor(Math.random() * pool.length)];
    const idToStore = REFLECTION_INVITATIONS.indexOf(prompt);
    await AsyncStorage.setItem(LAST_REFLECTION_PROMPT_KEY, String(idToStore >= 0 ? idToStore : 0));
    await AsyncStorage.setItem(LAST_REFLECTION_PROMPT_DATE_KEY, today);
    return prompt;
  } catch {
    return REFLECTION_INVITATIONS[Math.floor(Math.random() * REFLECTION_INVITATIONS.length)];
  }
}

function getTodayLocalDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getYesterdayLocalDateString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

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

function createdAtToLocalDateString(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getPreviousDayString(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  const y2 = date.getFullYear();
  const m2 = date.getMonth();
  const d2 = date.getDate();
  return `${y2}-${String(m2 + 1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
}

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidReflectionInput(text: string): boolean {
  const visible = text.trim().replace(/\s/g, '');
  return visible.length >= 2;
}

function computeStreakFromLogDates(createdAts: string[]): { current: number; longest: number; lastDate: string | null } {
  const validDates = createdAts
    .map(createdAtToLocalDateString)
    .filter((s): s is string => Boolean(s) && YMD_REGEX.test(s));
  if (validDates.length === 0) return { current: 0, longest: 0, lastDate: null };
  const today = getTodayLocalDateString();
  const yesterday = getYesterdayLocalDateString();
  const dateStrings = [...new Set(validDates)].sort().reverse();
  const lastDate = dateStrings[0];
  const lastIsActive = lastDate === today || lastDate === yesterday;
  let current = 0;
  if (lastIsActive) {
    let expected = lastDate;
    for (const d of dateStrings) {
      if (d !== expected) break;
      current++;
      expected = getPreviousDayString(expected);
    }
  }
  let longest = 0;
  let run = 1;
  for (let i = 1; i < dateStrings.length; i++) {
    if (getPreviousDayString(dateStrings[i - 1]) === dateStrings[i]) run++;
    else {
      longest = Math.max(longest, run);
      run = 1;
    }
  }
  longest = Math.max(longest, run, current);
  return { current, longest, lastDate };
}

function normalizeLogDatesFromRpc(rpcData: unknown): string[] {
  if (!Array.isArray(rpcData)) return [];
  return rpcData
    .map((r) => {
      if (typeof r === 'string') return r;
      if (Array.isArray(r) && r.length > 0 && typeof r[0] === 'string') return r[0];
      if (r != null && typeof r === 'object' && !Array.isArray(r)) {
        const row = r as Record<string, unknown>;
        const at = row.created_at ?? row.createdAt;
        return typeof at === 'string' ? at : null;
      }
      return null;
    })
    .filter((s): s is string => typeof s === 'string');
}

async function fetchLogDatesForStreak(userId: string): Promise<string[]> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_sunrise_log_dates');
  if (!rpcError && rpcData != null) return normalizeLogDatesFromRpc(rpcData);
  const { data } = await supabase
    .from('sunrise_logs')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  return (data ?? []).map((r) => r?.created_at).filter((s): s is string => typeof s === 'string');
}

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function normalizedVantageFromInput(value: string | null | undefined): string | null {
  if (value == null || typeof value !== 'string') return null;
  const { normalizedVantage } = normalizeVantageForStorage(value);
  return normalizedVantage;
}

async function fetchStreakFromRpc(): Promise<{ current: number; longest: number; lastDate: string | null } | null> {
  const tz = getDeviceTimezone();
  const { data, error } = await supabase.rpc('get_my_streak', { p_timezone: tz });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const current = typeof r.current_streak === 'number' ? r.current_streak : typeof r.current_streak === 'string' ? parseInt(r.current_streak, 10) : 0;
  const longest = typeof r.longest_streak === 'number' ? r.longest_streak : typeof r.longest_streak === 'string' ? parseInt(r.longest_streak, 10) : 0;
  const lastDate = getTodayLocalDateString();
  return { current: Number.isNaN(current) ? 0 : current, longest: Number.isNaN(longest) ? 0 : Math.max(longest, current), lastDate };
}

async function fetchVantageMorningsCount(userId: string, normalizedName: string): Promise<number> {
  const { count, error } = await supabase
    .from('sunrise_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('normalized_vantage', normalizedName);
  if (!error && typeof count === 'number' && !Number.isNaN(count)) return count;
  if (error) {
    const isMissingCol = /column.*does not exist|normalized_vantage/i.test(error.message ?? '');
    if (!isMissingCol) console.warn('[SunVantage] fetchVantageMorningsCount error', error.message);
  }
  const { count: countLegacy, error: errLegacy } = await supabase
    .from('sunrise_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('vantage_name_normalized', normalizedName);
  if (!errLegacy && typeof countLegacy === 'number') return countLegacy;
  const { data } = await supabase
    .from('sunrise_logs')
    .select('normalized_vantage, vantage_name, user_input_vantage')
    .eq('user_id', userId);
  const rows = (data ?? []) as { normalized_vantage?: string | null; vantage_name?: string | null; user_input_vantage?: string | null }[];
  return rows.filter((r) => getNormalizedVantageFromRow(r) === normalizedName).length;
}

function getVantageNameFromParams(params: { vantageName?: string | string[] }): string | null {
  const v = params?.vantageName;
  if (v == null) return null;
  const s = Array.isArray(v) ? v[0] : v;
  const t = typeof s === 'string' ? s.trim() : '';
  return t === '' ? null : t;
}

export type SunriseLogContext = 'witness' | 'explorer' | 'retroactive';

const INTRO_MESSAGES: Record<SunriseLogContext, string> = {
  witness: "You showed up. That's enough.",
  explorer: 'Where did you meet the first light today?',
  retroactive: 'Even if it was just a moment.',
};

function getContextFromParams(params: { context?: string | string[] }): SunriseLogContext {
  const c = params?.context;
  if (c == null) return 'witness';
  const s = Array.isArray(c) ? c[0] : c;
  if (s === 'explorer' || s === 'retroactive') return s;
  return 'witness';
}

export type SunriseLogProps = {
  context?: SunriseLogContext;
  initialVantageName?: string | null;
};

type TodayRenderLog = {
  id: number | null;
  photo_url: string | null;
  created_at: string | null;
  reflection_text: string | null;
  vantage_name: string | null;
};

export function SunriseLog({
  context = 'witness',
  initialVantageName = null,
}: SunriseLogProps) {
  const Dawn = useDawn();
  const { mode } = useAppTheme();
  const isMorningLight = mode === 'morning-light';
  const styles = React.useMemo(() => makeStyles(Dawn, isMorningLight), [Dawn, isMorningLight]);
  const photoBucket = 'sunrise_photos';
  const pendingBucket = 'uploads_pending';
  const reflectionDebounceMs = 800;
  const signedUrlExpirySeconds = 60 * 60; // 1 hour

  const resolvePhotoDisplayUrl = async (
    photo_url: string | null | undefined,
    moderation_status?: string | null
  ) => {
    if (!photo_url || photo_url.startsWith('http://') || photo_url.startsWith('https://')) return photo_url ?? null;
    if (
      photo_url.startsWith('file://') ||
      photo_url.startsWith('content://') ||
      photo_url.startsWith('ph://') ||
      photo_url.startsWith('asset://')
    ) {
      return null;
    }
    const cleaned = photo_url.replace(/^\/+/, '');
    const isPendingRef = cleaned.startsWith(`${pendingBucket}/`);
    const key = isPendingRef
      ? cleaned.slice(`${pendingBucket}/`.length)
      : cleaned.startsWith(`${photoBucket}/`)
        ? cleaned.slice(`${photoBucket}/`.length)
        : cleaned;

    const shouldSignPending = moderation_status === 'pending' || isPendingRef;
    if (!shouldSignPending) {
      const publicUrl = supabase.storage.from(photoBucket).getPublicUrl(key).data?.publicUrl;
      return publicUrl ?? null;
    }

    const { data, error } = await supabase.storage
      .from(pendingBucket)
      .createSignedUrl(key, signedUrlExpirySeconds);

    if (error) {
      console.warn('[SunVantage] createSignedUrl error', { path: key, bucket: pendingBucket, message: error.message, name: error.name });
      return null;
    }
    return data?.signedUrl ?? null;
  };

  const [logging, setLogging] = useState(false);
  const [hasLogged, setHasLogged] = useState(false);
  const [error, setError] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [moderatingPhoto, setModeratingPhoto] = useState(false);
  const [logId, setLogId] = useState<number | null>(null);
  const [photoMessage, setPhotoMessage] = useState('');
  const [hasReplacedPhoto, setHasReplacedPhoto] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionAck, setReflectionAck] = useState(false);
  const [editingReflection, setEditingReflection] = useState(false);
  const reflectionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vantageInputValueRef = useRef('');
  const vantageInputFocusedRef = useRef(false);
  const vantageInputRef = useRef<TextInput>(null);
  const setVantageInputValueAndRef = useCallback((text: string) => {
    vantageInputValueRef.current = text;
    setVantageInputValue(text);
  }, []);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalSunrises, setTotalSunrises] = useState(0);
  const [lastWitnessDate, setLastWitnessDate] = useState<string | null>(null);
  const [globalCount, setGlobalCount] = useState<number | null>(null);
  const [vantageName, setVantageName] = useState('');
  const [vantageMorningsCount, setVantageMorningsCount] = useState<number | null>(null);
  const [editingVantage, setEditingVantage] = useState(false);
  const [vantageInputValue, setVantageInputValue] = useState('');
  const [profileCity, setProfileCity] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showLogCard, setShowLogCard] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [justLanded, setJustLanded] = useState(false);
  const [revealBadge, setRevealBadge] = useState<BadgeDef | null>(null);
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const previousEarnedBadgeIdsRef = useRef<string[]>([]);
  const justLandedRef = useRef(false);
  const pageCardOpacity = useRef(new Animated.Value(1)).current;
  const pageCardScale = useRef(new Animated.Value(1)).current;
  const sunriseCardGlow = useRef(new Animated.Value(0)).current;
  const breathPhase = useRef(new Animated.Value(0)).current;

  const { sunriseToday, sunriseTomorrow, sunriseCardTimeMessage, minutesToSunrise } = useMorningContext(profileCity ?? null);
  const sunrisePassed = minutesToSunrise != null && minutesToSunrise < 0;
  const showFirstLightCard = Boolean(hasLogged && revealBadge);
  const [reflectionInvitationText, setReflectionInvitationText] = useState<string | null>(null);
  const reflectionBlockYRef = useRef(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keepNoteBtnOpacity = useRef(new Animated.Value(0.5)).current;

  // Hours since sunrise (0 if before sunrise)
  const hoursSinceSunrise =
    minutesToSunrise != null && minutesToSunrise < 0 ? -minutesToSunrise / 60 : 0;

  // Glow intensity: after sunrise 0–2h strong, 2–6h medium, 6+ subtle; before sunrise very subtle
  const glowIntensity =
    minutesToSunrise != null && minutesToSunrise >= 0
      ? 0.06
      : hoursSinceSunrise <= 2
        ? 0.35
        : hoursSinceSunrise <= 6
          ? 0.2
          : 0.07;

  useEffect(() => {
    getReflectionInvitationAsync().then(setReflectionInvitationText);
  }, []);

  // Time-aware radial glow: smooth transition when intensity changes
  useEffect(() => {
    Animated.timing(sunriseCardGlow, {
      toValue: glowIntensity,
      duration: 1200,
      useNativeDriver: true,
    }).start();
  }, [sunriseCardGlow, glowIntensity]);

  // Subtle breathing on card border: 0→6px soft glow, cycle 8–10s, only within ~2h of sunrise
  useEffect(() => {
    if (hoursSinceSunrise > 2) {
      breathPhase.setValue(0);
      return;
    }
    const durationOut = 4500;
    const durationIn = 4500;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathPhase, {
          toValue: 1,
          duration: durationOut,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(breathPhase, {
          toValue: 0,
          duration: durationIn,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathPhase, hoursSinceSunrise]);

  useEffect(() => {
    if (hasLogged && justLanded) {
      // Keep this atomic: set start values and animate in the same effect.
      // On Android, splitting across effects can race and leave opacity at 0.
      pageCardOpacity.setValue(0);
      pageCardScale.setValue(0.98);
      Animated.parallel([
        Animated.timing(pageCardOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
        Animated.timing(pageCardScale, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start(() => setJustLanded(false));
      return;
    }
    // Safety reset: ensure card is visible whenever we're not in entry animation.
    pageCardOpacity.setValue(1);
    pageCardScale.setValue(1);
  }, [hasLogged, justLanded, pageCardOpacity, pageCardScale]);

  useEffect(() => {
    const loadTodayLog = async () => {
      setInitialLoading(true);
      setError('');
      setPhotoMessage('');

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
          setInitialLoading(false);
          return;
        }
        setCurrentUserId(userId);

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const [profileResult, countResult] = await Promise.all([
          supabase.from('profiles').select('current_streak, longest_streak, last_witness_date, city').eq('user_id', userId).maybeSingle(),
          supabase.rpc('get_today_sunrise_count'),
        ]);

        const profile = profileResult.data;
        setProfileCity(profile?.city ?? null);
        const raw = countResult.data;
        let count = 0;
        if (typeof raw === 'number' && !Number.isNaN(raw)) {
          count = raw;
        } else if (Array.isArray(raw) && raw.length > 0) {
          const first = raw[0];
          if (typeof first === 'number' && !Number.isNaN(first)) count = first;
          else if (first != null && typeof first === 'object' && typeof (first as { count?: number }).count === 'number') count = (first as { count: number }).count;
        } else if (raw != null && typeof raw === 'object') {
          const vals = Object.values(raw);
          const num = vals.find((v): v is number => typeof v === 'number' && !Number.isNaN(v));
          if (num !== undefined) count = num;
        }
        if (countResult.error) {
          console.warn('[SunVantage] get_today_sunrise_count error', countResult.error.message);
        }
        setGlobalCount(count);

        const [todayResult, allLogsResult] = await Promise.all([
          supabase
            .from('sunrise_logs')
            .select('id, photo_url, moderation_status, created_at, photo_replaced_once, reflection_text, vantage_name')
            .eq('user_id', userId)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString())
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('sunrise_logs')
            .select('created_at, vantage_name, reflection_text, city')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }),
        ]);

        const { data, error: logsError } = todayResult;
        let allLogs = (allLogsResult.data ?? []) as { created_at: string; vantage_name?: string | null; reflection_text?: string | null; city?: string | null }[];
        if (allLogsResult.error && /column.*does not exist|city/i.test(allLogsResult.error.message ?? '')) {
          const fallback = await supabase.from('sunrise_logs').select('created_at, vantage_name, reflection_text').eq('user_id', userId).order('created_at', { ascending: true });
          allLogs = (fallback.data ?? []) as { created_at: string; vantage_name?: string | null; reflection_text?: string | null; city?: string | null }[];
        }

        if (logsError) {
          setError(logsError.message || 'We could not check today’s sunrise. Please try again later.');
          setInitialLoading(false);
          return;
        }

        let streakCurrent: number;
        let streakLongest: number;
        let streakLastDate: string | null;
        const fromRpc = await fetchStreakFromRpc();
        if (fromRpc != null) {
          streakCurrent = fromRpc.current;
          streakLongest = fromRpc.longest;
          streakLastDate = fromRpc.lastDate;
        } else {
          const createdAtsForStreak = await fetchLogDatesForStreak(userId);
          const computed = computeStreakFromLogDates(createdAtsForStreak);
          streakCurrent = computed.current;
          streakLongest = computed.longest;
          streakLastDate = computed.lastDate;
        }
        setCurrentStreak(streakCurrent);
        setLongestStreak(streakLongest);
        setTotalSunrises(allLogs.length);
        setLastWitnessDate(streakLastDate ?? (profile?.last_witness_date != null ? String(profile.last_witness_date).slice(0, 10) : null));
        if (userId) {
          supabase
            .from('profiles')
            .update({
              current_streak: streakCurrent,
              longest_streak: streakLongest,
              last_witness_date: streakLastDate ?? null,
            })
            .eq('user_id', userId)
            .then(({ error: profileErr }) => {
              if (profileErr) console.warn('[SunVantage] profile streak sync on load', profileErr.message);
            });
        }

        // Ritual marker reveal: only show when a badge is newly earned by the just-saved log.
        // We always compute and cache earned badge ids so "already owned" markers never re-trigger on save.
        if (allLogs.length > 0) {
          try {
            const stats = computeBadgeStats(allLogs);
            const earned = getEarnedBadges(stats);
            const earnedAtByBadge = computeEarnedAtByBadge(allLogs, stats);
            const previousEarnedIds = previousEarnedBadgeIdsRef.current;

            if (justLandedRef.current) {
              const newlyEarned = earned.filter((b) => !previousEarnedIds.includes(b.id));
              if (newlyEarned.length > 0) {
                const toShow = [...newlyEarned].sort((a, b) => {
                  const atA = earnedAtByBadge[a.id] ?? '';
                  const atB = earnedAtByBadge[b.id] ?? '';
                  return atB.localeCompare(atA);
                })[0];
                setRevealBadge(toShow);
                await dismissBadgeReveal(toShow.id);
              } else {
                setRevealBadge(null);
              }
              justLandedRef.current = false;
              setJustLanded(false);
            } else {
              // Not just saved: do not show reveal here.
              setRevealBadge(null);
            }

            previousEarnedBadgeIdsRef.current = earned.map((b) => b.id);
          } catch {
            setRevealBadge(null);
          }
        }

        if (data && data.length > 0) {
          const todayLog = data[0] as { id: number; photo_url?: string | null; moderation_status?: string | null; photo_replaced_once?: boolean; reflection_text?: string | null; vantage_name?: string | null };
          setHasLogged(true);
          setLogId(todayLog.id);
          setHasReplacedPhoto(!!todayLog.photo_replaced_once);
          const savedReflection = todayLog.reflection_text ?? '';
          setReflectionText(savedReflection);
          setReflectionAck(savedReflection.length > 0);
          const savedVantage = todayLog.vantage_name ?? '';
          setVantageName(savedVantage);
          setVantageInputValue(savedVantage);
          setEditingVantage(false);
          const ref = todayLog.photo_url ?? null;
          setPhotoPath(ref);
          setImageError(false);

          if (ref) {
            const displayUrl = await resolvePhotoDisplayUrl(ref, todayLog.moderation_status ?? null);
            if (displayUrl) setPhotoUrl(displayUrl);
          } else {
            setPhotoUrl(null);
          }

          const norm = getNormalizedVantageFromRow(todayLog as { vantage_name?: string | null; normalized_vantage?: string | null; user_input_vantage?: string | null });
          if (norm && userId) {
            const count = await fetchVantageMorningsCount(userId, norm);
            setVantageMorningsCount(count);
          } else {
            setVantageMorningsCount(null);
          }
        }
      } catch (e) {
        setError('Something went wrong. Please try again later.');
      } finally {
        setInitialLoading(false);
      }
    };

    loadTodayLog();
  }, [refreshTrigger]);

  const handleVantageBlurRef = useRef<() => void>(() => {});
  useEffect(() => {
    handleVantageBlurRef.current = handleVantageBlur;
  }, [handleVantageBlur]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        if (vantageInputFocusedRef.current) {
          vantageInputFocusedRef.current = false;
          handleVantageBlurRef.current();
        }
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (editingVantage) {
      const t = setTimeout(() => vantageInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [editingVantage]);

  useEffect(() => {
    Animated.timing(keepNoteBtnOpacity, {
      toValue: isValidReflectionInput(reflectionText) ? 1 : 0.5,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [reflectionText, keepNoteBtnOpacity]);

  const handleLogSunrise = async () => {
    if (logging || hasLogged) return;

    setLogging(true);
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
        setError('We could not find your account. Please sign in again.');
        return;
      }

      // City-level dot: store one lat/lng per city on each log.
      // Prefer profile coordinates; otherwise geocode by city and persist back to profile.
      const profileRes = await supabase
        .from('profiles')
        .select('city, latitude, longitude')
        .eq('user_id', userId)
        .maybeSingle();
      const profile = profileRes.data as { city?: string | null; latitude?: number | null; longitude?: number | null } | null;
      const profileCity = profile?.city?.trim() ?? '';
      let lat = typeof profile?.latitude === 'number' ? profile?.latitude : null;
      let lng = typeof profile?.longitude === 'number' ? profile?.longitude : null;
      if (profileCity && (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng))) {
        const geo = await getCoordinatesForCity(profileCity, { userId, supabase });
        lat = geo?.latitude ?? null;
        lng = geo?.longitude ?? null;
      }

      const displayVantage = initialVantageName ?? null;
      const vantageNorm = displayVantage != null && displayVantage !== '' ? normalizeVantageForStorage(displayVantage) : null;
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
      } = {
        user_id: userId,
        created_at: new Date().toISOString(),
        sunrise_day: getTodayLocalDateString(),
      };
      if (profileCity) insertPayload.city = profileCity;
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

      const { data, error: insertError } = await supabase
        .from('sunrise_logs')
        .insert(insertPayload)
        .select()
        .limit(1);

      if (insertError) {
        setError(insertError.message || 'We could not log this sunrise. Please try again.');
        return;
      }

      setHasLogged(true);
      setGlobalCount((prev) => (prev != null ? prev + 1 : 1));
      await clearTomorrowPlan();
      if (data && data.length > 0) {
        const newLog = data[0] as { id: number; photo_url?: string | null };
        setLogId(newLog.id);
        setPhotoUrl(newLog.photo_url ?? null);
      }
      setReflectionText('');
      if (vantageNorm != null && vantageNorm.userInputVantage !== '') {
        setVantageName(vantageNorm.userInputVantage);
        setVantageInputValue(vantageNorm.userInputVantage);
        setEditingVantage(false);
        if (vantageNorm.normalizedVantage != null && userId) {
          const count = await fetchVantageMorningsCount(userId, vantageNorm.normalizedVantage);
          setVantageMorningsCount(count);
        } else {
          setVantageMorningsCount(null);
        }
      } else {
        setVantageName('');
        setVantageMorningsCount(null);
        setEditingVantage(false);
        setVantageInputValue('');
      }

      const fromRpc = await fetchStreakFromRpc();
      let newCurrent: number;
      let newLongest: number;
      let newLastDate: string | null;
      if (fromRpc != null) {
        newCurrent = fromRpc.current;
        newLongest = fromRpc.longest;
        newLastDate = fromRpc.lastDate;
      } else {
        const createdAts = await fetchLogDatesForStreak(userId);
        const computed = computeStreakFromLogDates(createdAts);
        newCurrent = computed.current;
        newLongest = computed.longest;
        newLastDate = computed.lastDate;
      }

      setCurrentStreak(newCurrent);
      setLongestStreak(newLongest);
      setLastWitnessDate(newLastDate ?? getTodayLocalDateString());

      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          current_streak: newCurrent,
          longest_streak: newLongest,
          last_witness_date: newLastDate ?? getTodayLocalDateString(),
        })
        .eq('user_id', userId!);
      if (profileUpdateError) {
        console.warn('[SunVantage] profile streak update failed', profileUpdateError.message);
      }
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  const reflectionTextRef = useRef('');
  reflectionTextRef.current = reflectionText;

  const saveReflection = useCallback(async (showAck = false, background = false) => {
    const text = reflectionTextRef.current;
    if (logId == null) return;
    if (!isValidReflectionInput(text)) {
      if (!background) setSavingReflection(false);
      return;
    }
    if (!background) {
      setSavingReflection(true);
      setReflectionAck(false);
    }
    try {
      const { error: updateError } = await supabase
        .from('sunrise_logs')
        .update({ reflection_text: text.trim() || null })
        .eq('id', logId);
      if (updateError) console.warn('[SunVantage] saveReflection error', updateError.message);
      else if (showAck && !background) setReflectionAck(true);
    } finally {
      if (!background) setSavingReflection(false);
    }
  }, [logId]);

  const scheduleReflectionSave = useCallback(() => {
    if (reflectionDebounceRef.current) clearTimeout(reflectionDebounceRef.current);
    reflectionDebounceRef.current = setTimeout(() => {
      reflectionDebounceRef.current = null;
      saveReflection(false, true);
    }, reflectionDebounceMs);
  }, [saveReflection]);

  useEffect(() => {
    return () => {
      if (reflectionDebounceRef.current) clearTimeout(reflectionDebounceRef.current);
    };
  }, []);

  const handleReflectionChange = useCallback(
    (text: string) => {
      setReflectionText(text);
      scheduleReflectionSave();
    },
    [scheduleReflectionSave]
  );

  const handleReflectionBlur = useCallback(() => {
    if (reflectionDebounceRef.current) {
      clearTimeout(reflectionDebounceRef.current);
      reflectionDebounceRef.current = null;
    }
    saveReflection(false);
  }, [saveReflection]);

  const handleReflectionSubmit = useCallback(() => {
    if (!isValidReflectionInput(reflectionTextRef.current)) return;
    if (reflectionDebounceRef.current) {
      clearTimeout(reflectionDebounceRef.current);
      reflectionDebounceRef.current = null;
    }
    saveReflection(true);
  }, [saveReflection]);

  const handleVantageBlur = useCallback(async () => {
    if (logId == null) return;
    const raw = (vantageInputValueRef.current ?? '').trim();
    const vantageNorm = raw !== '' ? normalizeVantageForStorage(raw) : null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;

    if (vantageNorm === null || vantageNorm.userInputVantage === '') {
      let updateError = (await supabase
        .from('sunrise_logs')
        .update({
          vantage_name: null,
          vantage_name_normalized: null,
          user_input_vantage: null,
          normalized_vantage: null,
          vantage_category: null,
        })
        .eq('id', logId)).error;
      if (updateError) {
        updateError = (await supabase.from('sunrise_logs').update({ vantage_name: null }).eq('id', logId)).error;
      }
      if (updateError) console.warn('[SunVantage] saveVantage clear error', updateError.message);
      setVantageName('');
      setVantageMorningsCount(null);
      setEditingVantage(false);
      setVantageInputValue('');
      return;
    }

    const display = vantageNorm.userInputVantage;
    const updatePayload: Record<string, unknown> = {
      vantage_name: display,
      user_input_vantage: display,
      vantage_category: vantageNorm.vantageCategory,
    };
    if (vantageNorm.normalizedVantage != null) {
      updatePayload.vantage_name_normalized = vantageNorm.normalizedVantage;
      updatePayload.normalized_vantage = vantageNorm.normalizedVantage;
    }
    let updateError = (await supabase.from('sunrise_logs').update(updatePayload).eq('id', logId)).error;
    if (updateError) {
      updateError = (await supabase.from('sunrise_logs').update({ vantage_name: display }).eq('id', logId)).error;
    }
    if (updateError) {
      console.warn('[SunVantage] saveVantage error', updateError.message);
      return;
    }
    setVantageName(display);
    setEditingVantage(false);
    setVantageInputValue(display);
    const count =
      vantageNorm.normalizedVantage != null
        ? await fetchVantageMorningsCount(userId, vantageNorm.normalizedVantage)
        : 0;
    setVantageMorningsCount(count);
  }, [logId]);

  const handleAddPhoto = async () => {
    if (!hasLogged || uploadingPhoto || moderatingPhoto || logId == null) return;
    if (photoUrl && hasReplacedPhoto) return; // already used the one replace for today

    try {
      setUploadingPhoto(true);
      setError('');
      setPhotoMessage('');

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('We need permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) return;

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

      const timestamp = Date.now();
      const stagedPath = `${userId}/${logId}-${timestamp}.jpg`;

      // Use base64 from picker so upload has real bytes (fetch(asset.uri) often gives 0 bytes in RN)
      // RN Blob doesn't support ArrayBufferView; Supabase upload accepts Uint8Array/ArrayBuffer.
      let body: Uint8Array | null = null;
      if (asset.base64) {
        try {
          const binary = atob(asset.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          body = bytes;
        } catch (decodeErr) {
          console.warn('[SunVantage] base64 decode failed', decodeErr);
          setError('We could not read the image. Please try another photo.');
          return;
        }
      }

      if (!body) {
        setError('We could not read the image. Please try another photo.');
        return;
      }

      const { error: uploadError } = await supabase.storage.from(pendingBucket).upload(stagedPath, body, {
        contentType: asset.mimeType || 'image/jpeg',
        upsert: true,
      });

      if (uploadError) {
        setError(uploadError.message || 'We could not upload that photo. Please try again.');
        return;
      }

      const isReplacing = !!photoPath && !photoPath.startsWith('http');
      const pendingPhotoRef = `${pendingBucket}/${stagedPath}`;
      await supabase
        .from('sunrise_logs')
        .update({ moderation_status: 'pending', photo_url: pendingPhotoRef })
        .eq('id', logId)
        .eq('user_id', userId);

      // Keep UX non-blocking: show the picked photo immediately while moderation runs in background.
      setPhotoPath(pendingPhotoRef);
      setImageError(false);
      const pendingDisplayUrl = await resolvePhotoDisplayUrl(pendingPhotoRef, 'pending');
      setPhotoUrl(pendingDisplayUrl);
      setPhotoMessage('Your morning is part of something larger.');

      // DB photo_url + moderation_status are finalized by the Edge Function asynchronously.
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
          setRefreshTrigger((t) => t + 1);
        });

      if (isReplacing) {
        await supabase.from('sunrise_logs').update({ photo_replaced_once: true }).eq('id', logId);
      }

      if (isReplacing) setHasReplacedPhoto(true);
      if (isReplacing) {
        setPhotoMessage('Photo updated. Your morning was part of something larger.');
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong while adding your photo.';
      setError(message || 'Something went wrong while adding your photo.');
    } finally {
      setUploadingPhoto(false);
      setModeratingPhoto(false);
    }
  };

  const todayLog: TodayRenderLog | null =
    hasLogged || logId != null || photoPath != null || reflectionText.trim().length > 0 || vantageName.trim().length > 0
      ? {
          id: logId,
          photo_url: photoPath ?? null,
          created_at: null,
          reflection_text: reflectionText.trim() || null,
          vantage_name: vantageName.trim() || null,
        }
      : null;
  const activeLog: TodayRenderLog | null = todayLog;
  const effectivePhotoUrl = photoUrl ?? activeLog?.photo_url ?? null;
  const hasPhoto = typeof effectivePhotoUrl === 'string' && effectivePhotoUrl.trim().length > 0;
  const hasActiveLog = Boolean(activeLog || hasLogged);
  const showPhotoPlaceholder = hasPhoto && imageError;
  useEffect(() => {
    setImageError(false);
  }, [effectivePhotoUrl]);
  const backgroundColors = isMorningLight
    ? (['#EAF3FB', '#DCEAF7', '#CFE2F3'] as const)
    : (['#102A43', '#1B3554', '#243F63'] as const);
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={backgroundColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />
      <View style={styles.header}>
        <SunVantageHeader
          title="Today's Sunrise"
          subtitle={getWitnessSubheading(currentStreak, totalSunrises)}
          hasLoggedToday={hasActiveLog}
          wrapperMarginBottom={0}
          screenTitle
          onHeaderPress={() => router.push('/home')}
        >
          {currentStreak > 0 || longestStreak > 0 ? (
              <View style={styles.streakBlockWrap}>
                <StreakBlock
                  currentStreak={currentStreak}
                  longestStreak={longestStreak}
                  hideLongestWhenFirst={totalSunrises === 1}
                />
              </View>
            ) : (
              <Text style={styles.headerBeginHere}>The morning is still yours.</Text>
            )}
        </SunVantageHeader>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible && { paddingBottom: 320 },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.centerContent}>
          {hasLogged && revealBadge && (
            <RitualRevealCard
              visible={true}
              onDismiss={async () => {
                if (revealBadge) {
                  await dismissBadgeReveal(revealBadge.id);
                  setRevealBadge(null);
                }
              }}
              onViewMarkers={() => router.push('/ritual-markers')}
              icon={BADGE_ICONS[revealBadge.id]}
              title={revealBadge.title}
              description={revealBadge.earnedExplanation}
              ctaText="View markers"
            />
          )}
          {sunriseToday != null ? (
            <View style={[styles.sunriseCardWrap, { marginTop: showFirstLightCard ? 24 : 8 }]}>
              <Animated.View
                style={[
                  styles.sunriseCardGlow,
                  {
                    opacity: sunriseCardGlow,
                    backgroundColor: 'rgba(255,185,105,0.08)',
                  },
                ]}
                pointerEvents="none"
              />
              <Animated.View
                style={[
                  styles.sunriseContextCard,
                  {
                    shadowColor: 'rgb(255,180,80)',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: breathPhase.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.25, 0],
                    }),
                    shadowRadius: breathPhase.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 6],
                    }),
                  },
                ]}
              >
                <View style={styles.sunTitleRow}>
                  <Text style={styles.sunEmoji}>☀️</Text>
                  <Text style={styles.sunTitle}>Sunrise today</Text>
                </View>
                <Text style={styles.sunriseContextCardCityTime}>
                  {profileCity || 'your city'} · {formatSunriseTime(sunriseToday)}
                </Text>
                <Text style={styles.sunriseContextCardTagline}>
                  {hasLogged ? "You showed up. That's enough." : 'Earlier this morning'}
                </Text>
              </Animated.View>
            </View>
          ) : null}
            <>
              {initialLoading ? (
                <View style={styles.loadingInlineWrap}>
                  <ActivityIndicator color={Dawn.accent.sunrise} />
                </View>
              ) : null}
              {!hasLogged && sunrisePassed && (
                <View style={styles.reflectiveBlock}>
                  <Text style={styles.reflectiveLead}>Take a moment.</Text>
                  <Text style={styles.reflectivePrompt}>Where were you when the light arrived?</Text>
                </View>
              )}
              {!hasLogged && (
                <Pressable
                  style={({ pressed }) => [styles.logThisMorningBtn, pressed && styles.logThisMorningBtnPressed]}
                  onPress={() => setShowLogCard(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Log this morning"
                >
                  <Text style={styles.logThisMorningBtnText}>Log this morning</Text>
                </Pressable>
              )}
              {!hasLogged && sunrisePassed && (
                <Text style={styles.witnessFooter}>You don&apos;t have to capture it.{'\n'}Just mark the moment.</Text>
              )}

              {hasActiveLog && globalCount !== null && globalCount >= 2 && (
                <Text style={styles.globalCountMuted}>
                  {globalCount} people greeted sunrise on SunVantage today.
                </Text>
              )}

              {hasActiveLog && (
                <Animated.View
                  style={[
                    styles.yourMorningCard,
                    {
                      opacity: pageCardOpacity,
                      transform: [{ scale: pageCardScale }],
                    },
                  ]}
                >
                  <View style={styles.yourMorningHeader}>
                    <View style={styles.titleRow}>
                      <Text style={styles.titleEmoji}>🌅</Text>
                      <Text style={styles.yourMorningCardHeader}>Your morning</Text>
                    </View>
                    {(!vantageName || editingVantage) ? (
                      <TextInput
                        ref={vantageInputRef}
                        style={[styles.yourMorningVantageInput, styles.yourMorningVantageInputInline]}
                        value={vantageInputValue}
                        onChangeText={setVantageInputValueAndRef}
                        onFocus={() => { vantageInputFocusedRef.current = true; }}
                        onBlur={() => {
                          vantageInputFocusedRef.current = false;
                          handleVantageBlur();
                        }}
                        placeholder="Where are you today?"
                        placeholderTextColor={Dawn.text.secondary}
                        returnKeyType="done"
                        onSubmitEditing={() => { Keyboard.dismiss(); handleVantageBlur(); }}
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          setVantageInputValueAndRef(vantageName);
                          setEditingVantage(true);
                        }}
                        style={styles.vantageInlineTouchable}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.yourMorningVantageLine}>📍 {vantageName}</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.yourMorningPhotoSection}>
                    {!hasPhoto ? (
                      <TouchableOpacity
                        style={styles.yourMorningAddPhoto}
                        onPress={handleAddPhoto}
                        activeOpacity={0.85}
                        disabled={uploadingPhoto}
                      >
                        {uploadingPhoto ? (
                          <ActivityIndicator color={Dawn.text.primary} />
                        ) : (
                          <Text style={styles.secondaryButtonText}>+ Add photo</Text>
                        )}
                      </TouchableOpacity>
                    ) : showPhotoPlaceholder ? (
                      <View style={styles.yourMorningPhotoPlaceholder}>
                        <Text style={styles.yourMorningPhotoPlaceholderText}>Photo is still processing...</Text>
                      </View>
                    ) : (
                      <>
                        <View style={styles.yourMorningPhotoWrap}>
                          <Image
                            source={{ uri: effectivePhotoUrl! }}
                            style={styles.yourMorningPhoto}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="none"
                            onError={() => setImageError(true)}
                            onLoad={() => setImageError(false)}
                          />
                        </View>
                      </>
                    )}
                  </View>

                  <View
                    style={styles.yourMorningReflection}
                    onLayout={(e) => { reflectionBlockYRef.current = e.nativeEvent.layout.y; }}
                  >
                    <Text style={styles.yourMorningReflectionPrompt}>What stayed with you today?</Text>
                    {editingReflection ? (
                      <>
                        <TextInput
                          style={styles.yourMorningReflectionNote}
                          value={reflectionText}
                          onChangeText={handleReflectionChange}
                          onBlur={handleReflectionBlur}
                          onFocus={() => {
                            setTimeout(() => {
                              scrollRef.current?.scrollTo({
                                y: Math.max(0, reflectionBlockYRef.current - 80),
                                animated: true,
                              });
                            }, 300);
                          }}
                          placeholder="A word, a sentence, or just how it felt."
                          placeholderTextColor={Dawn.text.secondary}
                          multiline
                          numberOfLines={4}
                          textAlignVertical="top"
                          editable={!savingReflection}
                        />
                        <Animated.View style={{ opacity: keepNoteBtnOpacity }}>
                          <TouchableOpacity
                            style={[
                              styles.reflectionSubmitBtn,
                              (savingReflection || !isValidReflectionInput(reflectionText)) &&
                                styles.reflectionSubmitBtnDisabled,
                            ]}
                            onPress={async () => {
                              await handleReflectionSubmit();
                              setEditingReflection(false);
                            }}
                            disabled={savingReflection || !isValidReflectionInput(reflectionText)}
                            activeOpacity={0.85}
                          >
                            {savingReflection ? (
                              <ActivityIndicator color={Dawn.text.primary} size="small" />
                            ) : (
                              <Text style={styles.reflectionSubmitBtnText}>Keep this note</Text>
                            )}
                          </TouchableOpacity>
                        </Animated.View>
                      </>
                    ) : (
                      <>
                        {reflectionText?.trim() ? (
                          <Text style={styles.yourMorningReflectionQuote} numberOfLines={3}>
                            “{reflectionText.trim()}”
                          </Text>
                        ) : (
                          <Text style={styles.yourMorningReflectionQuoteMuted}>
                            “A word, a sentence, or just how it felt.”
                          </Text>
                        )}
                        <View style={styles.yourMorningActionsRow}>
                          <TouchableOpacity
                            style={styles.actionLink}
                            onPress={() => setEditingReflection(true)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.actionLinkText}>
                              {reflectionText?.trim() ? 'Edit reflection' : 'Add reflection'}
                            </Text>
                          </TouchableOpacity>
                          {hasPhoto ? (
                            <TouchableOpacity
                              style={styles.actionLink}
                              onPress={handleAddPhoto}
                              disabled={uploadingPhoto}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.actionLinkText}>Change photo</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.yourMorningSaved}>
                    <Text style={styles.yourMorningSavedCheck}>✓ Saved</Text>
                    <Text style={styles.yourMorningSavedCopy}>Just between you and the moment.</Text>
                  </View>
                </Animated.View>
              )}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {!hasLogged ? (
                <View style={styles.sharedDawnSectionWrap}>
                  <SharedDawnPreview city={profileCity} currentUserId={currentUserId} fromScreen="witness" />
                </View>
              ) : null}

              {hasLogged ? (
                <>
                  <DawnInvitationSection
                    city={profileCity}
                    sunriseTomorrow={sunriseTomorrow}
                  />
                  <View style={styles.sharedDawnSectionWrap}>
                    <SharedDawnPreview
                      city={profileCity}
                      currentUserId={currentUserId}
                      fromScreen="witness"
                      showEmptyState={false}
                    />
                  </View>
                </>
              ) : null}
            </>
          </View>
          </TouchableWithoutFeedback>
        </ScrollView>
      </KeyboardAvoidingView>

      <SunriseLogCard
        visible={showLogCard}
        onClose={() => setShowLogCard(false)}
        onSaved={(result) => {
          setShowLogCard(false);
          setJustLanded(true);
          justLandedRef.current = true;
          if (result?.pendingPhotoRef) {
            setPhotoPath(result.pendingPhotoRef);
          }
          setRefreshTrigger((t) => t + 1);
        }}
        onModerationComplete={() => setRefreshTrigger((t) => t + 1)}
        onPlanForTomorrow={() => router.push('/tomorrow-plan')}
        city={profileCity}
        sunriseTime={sunriseToday}
        initialVantageName={initialVantageName}
      />
    </View>
  );
}

function makeStyles(Dawn: ReturnType<typeof useDawn>, isMorningLight: boolean) {
  return StyleSheet.create({
  titleRowCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sunTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sunEmoji: {
    fontSize: 18,
  },
  sunTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Dawn.text.primary,
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleEmoji: {
    fontSize: 17,
    lineHeight: 22,
  },
  container: {
    flex: 1,
    backgroundColor: Dawn.background.primary,
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    marginBottom: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerChevronWrap: {
    marginLeft: 4,
  },
  headerChevron: {
    opacity: 0.6,
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
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 0.8,
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  streakBlockWrap: {
    marginTop: 12,
    marginBottom: 0,
  },
  headerBeginHere: {
    marginTop: 4,
    fontSize: 14,
    color: Dawn.text.secondary,
    fontStyle: 'italic',
  },
  loadingInlineWrap: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalCount: {
    marginTop: 14,
    fontSize: 12,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  globalCountMuted: {
    marginTop: 12,
    marginBottom: 12,
    fontSize: 10,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  sunriseCardWrap: {
    position: 'relative',
    alignSelf: 'stretch',
    marginTop: 8,
    marginBottom: 0,
  },
  /* Wide elliptical horizon-style glow behind the Sunrise card */
  sunriseCardGlow: {
    position: 'absolute',
    top: -32,
    left: -40,
    right: -40,
    bottom: -20,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    maxHeight: 200,
  },
  sunriseContextCard: {
    backgroundColor: Dawn.surface.card,
    borderRadius: 22,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Dawn.border.sunriseCard,
    elevation: 2,
    alignSelf: 'stretch',
  },
  sunriseContextCardCityTime: {
    fontSize: 14,
    color: Dawn.text.secondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  sunriseContextCardTagline: {
    fontSize: 13,
    color: Dawn.text.secondary,
    opacity: 0.9,
    textAlign: 'center',
  },
  reflectiveBlock: {
    marginTop: 24,
    marginBottom: 18,
    alignItems: 'center',
    maxWidth: 280,
    alignSelf: 'center',
  },
  reflectiveLead: {
    fontSize: 14,
    lineHeight: 20,
    color: Dawn.text.secondary,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 8,
  },
  reflectivePrompt: {
    fontSize: 16,
    lineHeight: 22,
    color: Dawn.text.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  sunriseContextCardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
    marginBottom: 8,
  },
  centerContent: {
    alignItems: 'center',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 10,
    paddingBottom: 24,
  },
  scrollContentWithMarker: {
    paddingTop: 8,
  },
  centerInvitation: {
    marginBottom: 14,
    fontSize: 18,
    fontWeight: '500',
    color: 'rgba(249, 250, 251, 0.78)',
    textAlign: 'center',
  },
  centerInvitationPostSunrise: {
    marginTop: 14,
  },
  ritualWrapper: {
    alignItems: 'center',
    marginBottom: 4,
  },
  ritualTouchable: {
    alignItems: 'center',
    marginBottom: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  ritualGlowContainer: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  ritualGlowRise: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 179, 71, 0.12)',
  },
  horizonLineRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizonLine: {
    width: 220,
    height: 1,
    backgroundColor: Dawn.accent.sunrise,
    ...Platform.select({
      ios: {
        shadowColor: Dawn.accent.sunrise,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: { elevation: 0 },
    }),
  },
  horizonLineInactive: {
    width: 220,
    height: 1,
    backgroundColor: Dawn.border.subtle,
    marginBottom: 16,
  },
  ritualCtaContent: {
    alignItems: 'center',
  },
  ritualCtaTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ritualCtaText: {
    fontSize: 17,
    fontWeight: '600',
    color: Dawn.text.primary,
    letterSpacing: 0.3,
  },
  ritualCtaChevron: {
    fontSize: 14,
    color: Dawn.text.secondary,
  },
  ritualCtaUnderline: {
    width: 120,
    height: 1,
    marginTop: 6,
    backgroundColor: Dawn.accent.sunrise,
  },
  ritualCtaTextLogged: {
    fontSize: 17,
    fontWeight: '500',
    color: 'rgba(74, 222, 128, 0.95)',
    letterSpacing: 0.3,
  },
  ritualLoader: {
    marginTop: 12,
  },
  logThisMorningBtn: {
    marginTop: 20,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 179, 71, 0.86)',
  },
  logThisMorningBtnPressed: {
    opacity: 0.9,
  },
  logThisMorningBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Dawn.accent.sunriseOn,
  },
  sharedDawnSectionWrap: {
    marginTop: 28,
    width: '100%',
  },
  witnessFooter: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 22,
    color: Dawn.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
    maxWidth: 280,
  },
  subtext: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
    color: Dawn.text.primary,
    textAlign: 'center',
    maxWidth: 280,
  },
  subtextHelper: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 21,
    color: Dawn.text.secondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  yourMorningCard: {
    marginTop: 10,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    backgroundColor: isMorningLight ? Dawn.surface.card : 'rgba(22, 47, 82, 0.85)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
  },
  yourMorningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  yourMorningCardHeader: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '600',
    color: Dawn.text.primary,
    flexShrink: 0,
  },
  yourMorningVantageLine: {
    fontSize: 14,
    color: Dawn.text.secondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  yourMorningVantageInput: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    backgroundColor: Dawn.background.primary,
    color: Dawn.text.primary,
    fontSize: 15,
    textAlign: 'center',
    width: '100%',
  },
  yourMorningVantageInputInline: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  yourMorningPhotoSection: {
    marginTop: 0,
    marginBottom: 12,
    alignItems: 'center',
  },
  yourMorningAddPhoto: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Dawn.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yourMorningPhotoWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    marginBottom: 0,
  },
  yourMorningPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  yourMorningPhotoPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yourMorningPhotoPlaceholderText: {
    fontSize: 12,
    color: Dawn.text.secondary,
  },
  yourMorningReflection: {
    marginBottom: 0,
  },
  yourMorningReflectionPrompt: {
    fontSize: 12,
    color: Dawn.text.secondary,
    opacity: 0.85,
    marginBottom: 6,
  },
  yourMorningReflectionQuote: {
    fontSize: 14,
    lineHeight: 22,
    color: isMorningLight ? Dawn.text.primary : Dawn.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  yourMorningReflectionQuoteMuted: {
    fontSize: 14,
    lineHeight: 22,
    color: Dawn.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.8,
    marginBottom: 8,
  },
  yourMorningActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    flexWrap: 'wrap',
    paddingTop: 8,
    paddingBottom: 10,
  },
  actionLink: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: Dawn.accent.sunrise,
  },
  yourMorningReflectionNote: {
    minHeight: 72,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: isMorningLight ? 1 : 0,
    borderColor: isMorningLight ? Dawn.border.subtle : 'transparent',
    backgroundColor: isMorningLight ? Dawn.surfaceSecondary.subtle : 'rgba(14, 34, 61, 0.5)',
    color: Dawn.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  yourMorningSaved: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
    borderTopWidth: 1,
    borderTopColor: Dawn.border.subtle,
  },
  yourMorningSavedCheck: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(74, 222, 128, 0.95)',
  },
  yourMorningSavedCopy: {
    fontSize: 12,
    color: Dawn.text.secondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  vantageBlock: {
    marginTop: 20,
    marginBottom: 42,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
    alignItems: 'center',
  },
  vantageLabel: {
    fontSize: 12,
    color: Dawn.text.secondary,
    marginBottom: 6,
    textAlign: 'center',
  },
  vantageReflectionLine: {
    marginTop: 10,
    fontSize: 12,
    color: Dawn.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  vantageInput: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: Dawn.border.subtle,
    backgroundColor: Dawn.surface.card,
    color: Dawn.text.primary,
    fontSize: 15,
    textAlign: 'center',
    width: '100%',
  },
  vantageInlineTouchable: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  vantageInlineText: {
    fontSize: 16,
    fontWeight: '400',
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  vantageWelcomeBlockTouchable: {
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  vantageWelcome: {
    fontSize: 15,
    fontWeight: '400',
    color: Dawn.text.primary,
    textAlign: 'center',
  },
  vantageCount: {
    marginTop: 6,
    fontSize: 13,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  afterLog: {
    marginTop: 20,
    alignItems: 'center',
  },
  secondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    backgroundColor: Dawn.surface.card,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: Dawn.text.primary,
  },
  photoMessageCentered: {
    marginTop: 10,
    fontSize: 14,
    color: Dawn.text.primary,
    textAlign: 'center',
    maxWidth: 280,
  },
  replacePhotoLink: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  replacePhotoLinkText: {
    fontSize: 12,
    color: Dawn.text.secondary,
  },
  reflectionBlock: {
    marginTop: 24,
    width: '100%',
    maxWidth: 320,
    alignSelf: 'center',
  },
  reflectionInvitation: {
    fontSize: 16,
    fontWeight: '400',
    color: Dawn.text.secondary,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  reflectionInput: {
    minHeight: 72,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
    backgroundColor: Dawn.surface.card,
    color: Dawn.text.primary,
    fontSize: 15,
    lineHeight: 22,
  },
  reflectionSubmitBtn: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reflectionSubmitBtnDisabled: {
    opacity: 0.6,
  },
  reflectionSubmitBtnText: {
    fontSize: 14,
    fontWeight: '400',
    color: Dawn.text.secondary,
  },
  reflectionAck: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '400',
    color: Dawn.accent.sunrise,
    textAlign: 'center',
  },
  reflectionPrivacy: {
    marginTop: 5,
    fontSize: 12,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  keyboardDismissHint: {
    marginTop: 8,
    fontSize: 11,
    color: Dawn.text.secondary,
    textAlign: 'center',
  },
  photoWrapper: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
  },
  photo: {
    width: 280,
    height: 140,
  },
  errorText: {
    marginTop: 20,
    fontSize: 13,
    color: '#FCA5A5',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'flex-start',
  },
  footerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quietLink: {
    paddingVertical: 4,
  },
  quietLinkText: {
    fontSize: 12,
    color: Dawn.text.secondary,
  },
  });
}

export default function SunriseWitnessScreen() {
  const params = useLocalSearchParams<{ vantageName?: string | string[]; context?: string | string[] }>();
  return (
    <SunriseLog
      context={getContextFromParams(params)}
      initialVantageName={getVantageNameFromParams(params)}
    />
  );
}
