/**
 * Shared dawn preview — up to 3 today sunrise photos from other users in the same city.
 * Used on Witness and Vantage Hunt below the main ritual content.
 * Same image component and full-screen modal viewer as the gallery; no usernames, likes, or comments.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  FlatList,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import supabase from '../supabase';
import { Dawn } from '../constants/theme';
import { getFullScreenOverlayLines } from '../lib/vantageUtils';

const BUCKET = 'sunrise_photos';
const TILE_SIZE = 76;
const TILE_GAP = 8;
const LIMIT = 3;

type Row = {
  photo_url: string;
  vantage_name: string | null;
  created_at: string;
  vantage_category?: 'private' | 'public' | null;
};

function getPublicUrl(ref: string): string {
  if (!ref) return '';
  const key = ref.replace(/^\/+/, '').replace(new RegExp(`^${BUCKET}\/`), '');
  return supabase.storage.from(BUCKET).getPublicUrl(key).data?.publicUrl ?? '';
}

type Props = {
  city: string | null;
  currentUserId: string | null;
};

export default function SharedDawnPreview({ city, currentUserId }: Props) {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [rows, setRows] = useState<Row[]>([]);
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const listRef = useRef<FlatList<Row> | null>(null);
  const modalScale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!city?.trim() || !currentUserId) {
      setRows([]);
      setUrls([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from('sunrise_logs')
        .select('photo_url, vantage_name, created_at, vantage_category')
        .eq('city', city.trim())
        .neq('user_id', currentUserId)
        .not('photo_url', 'is', null)
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      if (cancelled) return;
      if (error || !data?.length) {
        setRows([]);
        setUrls([]);
        return;
      }
      const list = data as Row[];
      setRows(list);
      setUrls(list.map((r) => getPublicUrl(r.photo_url) || null));
    })();
    return () => { cancelled = true; };
  }, [city, currentUserId]);

  useEffect(() => {
    if (modalIndex != null) setVisibleIndex(modalIndex);
  }, [modalIndex]);

  useEffect(() => {
    if (modalIndex == null) return;
    modalScale.setValue(0.96);
    Animated.timing(modalScale, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [modalIndex, modalScale]);

  useEffect(() => {
    if (modalIndex == null) {
      overlayOpacity.setValue(0);
      return;
    }
    overlayOpacity.setValue(0);
    const t = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0.88,
        duration: 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, 300);
    return () => clearTimeout(t);
  }, [modalIndex, overlayOpacity]);

  if (rows.length === 0) return null;

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.title}>Shared dawn in {city!.trim()}</Text>
        <View style={styles.row}>
          {rows.map((row, index) => {
            const url = urls[index];
            return (
              <Pressable
                key={`${row.created_at}-${index}`}
                style={[
                  styles.tile,
                  {
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    marginRight: index < rows.length - 1 ? TILE_GAP : 0,
                  },
                ]}
                onPress={() => url && setModalIndex(index)}
              >
                {url ? (
                  <Image source={{ uri: url }} style={styles.tileImage} contentFit="cover" />
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <Pressable
          style={({ pressed }) => [styles.seeMore, pressed && { opacity: 0.72 }]}
          onPress={() => router.push('/my-city-sunrises')}
        >
          <Text style={styles.seeMoreText}>See more →</Text>
        </Pressable>
      </View>

      <Modal
        visible={modalIndex != null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalIndex(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.fullScreenBackdrop} onPress={() => setModalIndex(null)}>
          <Pressable style={styles.modalSurface} onPress={() => {}}>
            <FlatList
              ref={(r) => { listRef.current = r; }}
              data={rows}
              keyExtractor={(_, i) => `modal-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={modalIndex ?? 0}
              getItemLayout={(_, i) => ({ length: windowWidth, offset: windowWidth * i, index: i })}
              onScrollToIndexFailed={() => {}}
              onMomentumScrollEnd={(e) => {
                const next = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
                setVisibleIndex(next);
              }}
              renderItem={({ item, index }) => {
                const url = urls[index] ?? null;
                const isActive = index === visibleIndex;
                const isFirst = index === 0;
                const isLast = index === rows.length - 1;
                const jumpTo = (next: number) => {
                  listRef.current?.scrollToIndex({ index: next, animated: true });
                  setVisibleIndex(next);
                };
                const cityStr = (city ?? '').trim();
                const { line1, line2 } = getFullScreenOverlayLines(
                  item.vantage_name,
                  cityStr,
                  item.created_at,
                  item.vantage_category,
                  false
                );
                return (
                  <View style={{ width: windowWidth, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={styles.modalCenteredContainer}>
                      <Animated.View
                        style={[
                          styles.modalImageFrame,
                          {
                            width: Math.min(windowWidth - 48, 420),
                            height: Math.min(windowHeight * 0.7, windowWidth - 48, 420),
                          },
                          { transform: [{ scale: modalScale }] },
                        ]}
                      >
                        {isActive && !isFirst ? (
                          <Pressable
                            style={[styles.modalNavBtn, styles.modalNavBtnLeft]}
                            onPress={() => jumpTo(index - 1)}
                          >
                            <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.92)" />
                          </Pressable>
                        ) : null}
                        {isActive && !isLast ? (
                          <Pressable
                            style={[styles.modalNavBtn, styles.modalNavBtnRight]}
                            onPress={() => jumpTo(index + 1)}
                          >
                            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.92)" />
                          </Pressable>
                        ) : null}
                        <Pressable style={styles.modalClose} onPress={() => setModalIndex(null)}>
                          <Ionicons name="close" size={18} color="rgba(255,255,255,0.95)" />
                        </Pressable>
                        {url ? (
                          <Image source={{ uri: url }} style={styles.fullScreenImage} contentFit="contain" />
                        ) : null}
                        {isActive && (line1 || line2) ? (
                          <Animated.View style={[styles.fullScreenOverlay, { opacity: overlayOpacity }]} pointerEvents="none">
                            {line1 ? <Text style={styles.fullScreenOverlayVantage}>{line1}</Text> : null}
                            <Text style={styles.fullScreenOverlayMeta}>{line2}</Text>
                          </Animated.View>
                        ) : null}
                      </Animated.View>
                      <Text style={styles.modalIndexIndicator}>
                        {index + 1} / {rows.length}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 36,
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Dawn.text.secondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tile: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Dawn.surface.card,
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  seeMore: {
    marginTop: 10,
    alignSelf: 'center',
  },
  seeMoreText: {
    fontSize: 13,
    color: Dawn.accent.sunrise,
    fontWeight: '500',
  },
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSurface: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCenteredContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalImageFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalIndexIndicator: {
    marginTop: 12,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  modalNavBtn: {
    position: 'absolute',
    top: '50%',
    width: 40,
    height: 40,
    marginTop: -20,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  modalNavBtnLeft: { left: -8 },
  modalNavBtnRight: { right: -8 },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: 14,
  },
  fullScreenOverlayVantage: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  fullScreenOverlayMeta: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0.2,
  },
});
