import supabase from '../supabase';

const PHOTO_BUCKET = 'sunrise_photos';
const PENDING_BUCKET = 'uploads_pending';
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;
const CACHE_TTL_MS = 60 * 1000;
const CITY_GALLERY_LIMIT = 10;
const WORLD_GALLERY_LIMIT = 30;

type SunriseLogRow = {
  id: number;
  created_at: string;
  vantage_name: string | null;
  reflection_text: string | null;
  reflection_question_id: number | null;
  photo_url: string | null;
};

type CityGalleryRow = {
  photo_url: string;
  vantage_name: string | null;
  created_at: string;
  city?: string | null;
  vantage_category?: 'private' | 'public' | null;
  user_id?: string | null;
};

type WorldGalleryRow = {
  photo_url: string | null;
  created_at: string;
  city?: string | null;
  vantage_name?: string | null;
  user_id?: string | null;
};

export type MyMorningsCacheEntry = {
  userId: string;
  logs: SunriseLogRow[];
  imageUrls: Record<number, string | null>;
  userCity: string | null;
  galleryRows: CityGalleryRow[];
  fetchedAt: number;
};

export type WorldGalleryCacheEntry = {
  userId: string;
  rows: WorldGalleryRow[];
  fetchedAt: number;
};

const myMorningsCache = new Map<string, MyMorningsCacheEntry>();
const worldGalleryCache = new Map<string, WorldGalleryCacheEntry>();
const myMorningsInFlight = new Map<string, Promise<MyMorningsCacheEntry | null>>();
const worldGalleryInFlight = new Map<string, Promise<WorldGalleryCacheEntry | null>>();

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_TTL_MS;
}

function resolveCacheUrl(ref: string): Promise<string | null> {
  if (!ref) return Promise.resolve(null);
  if (ref.startsWith('http://') || ref.startsWith('https://')) return Promise.resolve(ref);
  if (
    ref.startsWith('file://') ||
    ref.startsWith('content://') ||
    ref.startsWith('ph://') ||
    ref.startsWith('asset://')
  ) {
    return Promise.resolve(null);
  }
  const cleaned = ref.replace(/^\/+/, '');
  const isPending = cleaned.startsWith(`${PENDING_BUCKET}/`);
  const bucket = isPending ? PENDING_BUCKET : PHOTO_BUCKET;
  const key = isPending
    ? cleaned.slice(`${PENDING_BUCKET}/`.length)
    : cleaned.replace(new RegExp(`^${PHOTO_BUCKET}\/`), '');
  return supabase.storage
    .from(bucket)
    .createSignedUrl(key, SIGNED_URL_EXPIRY_SECONDS)
    .then(({ data, error }) => {
      if (!error && data?.signedUrl) return data.signedUrl;
      if (bucket === PENDING_BUCKET) return null;
      const publicUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(key).data?.publicUrl;
      return publicUrl ?? null;
    });
}

export function getMyMorningsCache(userId: string): MyMorningsCacheEntry | null {
  return myMorningsCache.get(userId) ?? null;
}

export function isMyMorningsCacheFresh(userId: string): boolean {
  const cached = myMorningsCache.get(userId);
  return cached ? isFresh(cached.fetchedAt) : false;
}

export async function prefetchMyMornings(
  userId: string,
  opts?: { force?: boolean }
): Promise<MyMorningsCacheEntry | null> {
  const cached = myMorningsCache.get(userId);
  if (!opts?.force && cached && isFresh(cached.fetchedAt)) return cached;
  const inFlight = myMorningsInFlight.get(userId);
  if (inFlight) return inFlight;

  const task = (async () => {
    try {
      const [logsRes, profileRes] = await Promise.all([
        supabase
          .from('sunrise_logs')
          .select('id, created_at, vantage_name, reflection_text, reflection_question_id, photo_url')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('city').eq('user_id', userId).maybeSingle(),
      ]);
      if (logsRes.error) return null;

      const logs = (logsRes.data ?? []) as SunriseLogRow[];
      const profile = profileRes.data as { city: string | null } | null;
      const userCity = profile?.city?.trim() ?? null;

      const imageUrls: Record<number, string | null> = {};
      await Promise.all(
        logs.map(async (row) => {
          const ref = row.photo_url ?? null;
          if (!ref) {
            imageUrls[row.id] = null;
            return;
          }
          imageUrls[row.id] = await resolveCacheUrl(ref);
        })
      );

      let galleryRows: CityGalleryRow[] = [];
      if (logs.length === 0 && userCity) {
        const { data: galleryData, error: galleryError } = await supabase
          .from('sunrise_logs')
          .select('photo_url, vantage_name, created_at, city, vantage_category, user_id')
          .eq('city', userCity)
          .not('photo_url', 'is', null)
          .eq('moderation_status', 'approved')
          .order('created_at', { ascending: false })
          .limit(CITY_GALLERY_LIMIT);
        if (!galleryError && galleryData?.length) {
          galleryRows = galleryData as CityGalleryRow[];
        }
      }

      const entry: MyMorningsCacheEntry = {
        userId,
        logs,
        imageUrls,
        userCity,
        galleryRows,
        fetchedAt: Date.now(),
      };
      myMorningsCache.set(userId, entry);
      return entry;
    } finally {
      myMorningsInFlight.delete(userId);
    }
  })();

  myMorningsInFlight.set(userId, task);
  return task;
}

export function getWorldGalleryCache(userId: string): WorldGalleryCacheEntry | null {
  return worldGalleryCache.get(userId) ?? null;
}

export function isWorldGalleryCacheFresh(userId: string): boolean {
  const cached = worldGalleryCache.get(userId);
  return cached ? isFresh(cached.fetchedAt) : false;
}

export async function prefetchWorldGallery(
  userId: string,
  opts?: { force?: boolean }
): Promise<WorldGalleryCacheEntry | null> {
  const cached = worldGalleryCache.get(userId);
  if (!opts?.force && cached && isFresh(cached.fetchedAt)) return cached;
  const inFlight = worldGalleryInFlight.get(userId);
  if (inFlight) return inFlight;

  const task = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_global_sunrise_gallery', {
        limit_count: WORLD_GALLERY_LIMIT,
      });
      if (error) return null;
      const entry: WorldGalleryCacheEntry = {
        userId,
        rows: (data ?? []) as WorldGalleryRow[],
        fetchedAt: Date.now(),
      };
      worldGalleryCache.set(userId, entry);
      return entry;
    } finally {
      worldGalleryInFlight.delete(userId);
    }
  })();

  worldGalleryInFlight.set(userId, task);
  return task;
}
