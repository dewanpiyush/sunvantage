/**
 * Reusable gallery grid + modal for city sunrise photos.
 * Used by: My Mornings ("Morning light across {city}") and My City's Sunrises screen.
 * Same layout, tile sizing, image modal, and swipe navigation.
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
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import supabase from '../supabase';
import { useDawn } from '@/hooks/use-dawn';
import { getFullScreenOverlayLines, toTitleCaseVantage, shouldShowVantageName } from '../lib/vantageUtils';

const BUCKET = 'sunrise_photos';

export type CitySunriseGalleryRow = {
  photo_url: string;
  vantage_name: string | null;
  created_at: string;
  city?: string | null;
  vantage_category?: 'private' | 'public' | null;
  user_id?: string | null;
};

function getPublicUrl(ref: string): string {
  if (!ref) return '';
  const key = ref.replace(/^\/+/, '').replace(new RegExp(`^${BUCKET}\/`), '');
  return supabase.storage.from(BUCKET).getPublicUrl(key).data?.publicUrl ?? '';
}

function formatShortMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Props = {
  rows: CitySunriseGalleryRow[];
  limit: number;
  /** Used when rows don't include city (e.g. My City's Sunrises). */
  cityFallback?: string | null;
  /** Current viewer's user id; used to show vantage name for private vantages when viewer = owner. */
  currentUserId?: string | null;
  /** When true, overlay uses city name instead of vantage (for global gallery). */
  showCityOverlay?: boolean;
};

export default function CitySunriseGallery({ rows, limit, cityFallback, currentUserId, showCityOverlay }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const Dawn = useDawn();
  const styles = React.useMemo(() => makeStyles(Dawn), [Dawn]);
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [galleryVisibleIndex, setGalleryVisibleIndex] = useState(0);
  const galleryListRef = useRef<FlatList<CitySunriseGalleryRow> | null>(null);
  const modalScale = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const data = rows.slice(0, limit);

  useEffect(() => {
    const list = data.map((row) => getPublicUrl(row.photo_url) || null);
    setUrls(list);
  }, [rows, limit]);

  useEffect(() => {
    if (galleryIndex != null) setGalleryVisibleIndex(galleryIndex);
  }, [galleryIndex]);

  useEffect(() => {
    if (galleryIndex == null) return;
    modalScale.setValue(0.96);
    Animated.timing(modalScale, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [galleryIndex, modalScale]);

  useEffect(() => {
    if (galleryIndex == null) {
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
  }, [galleryIndex, overlayOpacity]);

  if (data.length === 0) return null;

  const tileSize = (windowWidth - 48 - 16) / 3;

  return (
    <>
      <View style={[styles.galleryGrid, { width: windowWidth - 48 }]}>
        {data.map((row, index) => {
          const url = urls[index];
          const cityLabel = (row.city ?? cityFallback ?? '').trim();
          return (
            <Pressable
              key={`${row.created_at}-${index}`}
              style={[
                styles.galleryTile,
                {
                  width: tileSize,
                  height: tileSize,
                  marginRight: index % 3 === 2 ? 0 : 8,
                  marginBottom: 8,
                },
              ]}
              onPress={() => url && setGalleryIndex(index)}
            >
              {url ? (
                <Image source={{ uri: url }} style={styles.galleryTileImage} contentFit="cover" />
              ) : null}
              {row.created_at ? (
                <View style={styles.galleryTileDateChip}>
                  <Text style={styles.galleryTileDateText}>{formatShortMonthDay(row.created_at)}</Text>
                </View>
              ) : null}
              {showCityOverlay
                ? cityLabel && (
                    <View style={styles.galleryTileOverlay}>
                      <Text style={styles.galleryTileVantage} numberOfLines={1}>
                        {cityLabel}
                      </Text>
                    </View>
                  )
                : row.vantage_name?.trim() &&
                  shouldShowVantageName(
                    row.vantage_category ?? null,
                    currentUserId != null && row.user_id === currentUserId
                  ) && (
                    <View style={styles.galleryTileOverlay}>
                      <Text style={styles.galleryTileVantage} numberOfLines={1}>
                        {toTitleCaseVantage(row.vantage_name.trim())}
                      </Text>
                    </View>
                  )}
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={galleryIndex != null}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryIndex(null)}
        statusBarTranslucent
      >
        <Pressable style={styles.fullScreenBackdrop} onPress={() => setGalleryIndex(null)}>
          <Pressable style={styles.modalSurface} onPress={() => {}}>
            <FlatList
              ref={(r) => { galleryListRef.current = r; }}
              data={data}
              keyExtractor={(item, i) => `${item.created_at}-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={galleryIndex ?? 0}
              getItemLayout={(_, i) => ({ length: windowWidth, offset: windowWidth * i, index: i })}
              onScrollToIndexFailed={() => {}}
              onMomentumScrollEnd={(e) => {
                const next = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
                setGalleryVisibleIndex(next);
              }}
              renderItem={({ item, index }) => {
                const url = urls[index] ?? null;
                const isActive = index === galleryVisibleIndex;
                const isFirst = index === 0;
                const isLast = index === data.length - 1;
                const jumpTo = (next: number) => {
                  galleryListRef.current?.scrollToIndex({ index: next, animated: true });
                  setGalleryVisibleIndex(next);
                };
                const city = (item.city ?? cityFallback ?? '').trim() || '';
                const viewerIsOwner = currentUserId != null && item.user_id === currentUserId;
                const { line1, line2 } = getFullScreenOverlayLines(
                  item.vantage_name,
                  city,
                  item.created_at,
                  item.vantage_category,
                  viewerIsOwner
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
                        <Pressable
                          style={styles.modalClose}
                          onPress={() => setGalleryIndex(null)}
                        >
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
                        {index + 1} / {data.length}
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

function makeStyles(Dawn: ReturnType<typeof useDawn>) {
  return StyleSheet.create({
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  galleryTile: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Dawn.surface.card,
    borderWidth: 1,
    borderColor: Dawn.border.subtle,
  },
  galleryTileImage: {
    width: '100%',
    height: '100%',
  },
  galleryTileDateChip: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  galleryTileDateText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.92)',
  },
  galleryTileOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  galleryTileVantage: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
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
}
