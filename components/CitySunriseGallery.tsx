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
import { Dawn } from '../constants/theme';

const BUCKET = 'sunrise_photos';

export type CitySunriseGalleryRow = {
  photo_url: string;
  vantage_name: string | null;
  created_at: string;
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

function toTitleCase(text: string): string {
  if (!text) return text;
  return text
    .split(' ')
    .map((w) => (w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

type Props = {
  rows: CitySunriseGalleryRow[];
  limit: number;
};

export default function CitySunriseGallery({ rows, limit }: Props) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [galleryVisibleIndex, setGalleryVisibleIndex] = useState(0);
  const galleryListRef = useRef<FlatList<CitySunriseGalleryRow> | null>(null);
  const modalScale = useRef(new Animated.Value(1)).current;

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

  if (data.length === 0) return null;

  const tileSize = (windowWidth - 48 - 16) / 3;

  return (
    <>
      <View style={[styles.galleryGrid, { width: windowWidth - 48 }]}>
        {data.map((row, index) => {
          const url = urls[index];
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
              {row.vantage_name?.trim() ? (
                <View style={styles.galleryTileOverlay}>
                  <Text style={styles.galleryTileVantage} numberOfLines={1}>
                    {toTitleCase(row.vantage_name.trim())}
                  </Text>
                </View>
              ) : null}
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

const styles = StyleSheet.create({
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  galleryTile: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Dawn.surface.card,
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
});
