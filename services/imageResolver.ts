import { getPlaceDetails, getPhotoUrl, type AmapPlace } from './amap';
import { searchImage } from './imageSearch';
import { getImageForPlace } from './unsplash';

export type ImageSource = 'amap' | 'search' | 'unsplash' | 'default' | 'google';
export type ImageRelevance = 'high' | 'medium' | 'low';

export interface ImageResult {
  url: string;
  source: ImageSource;
  relevance: ImageRelevance;
}

interface PlaceLike {
  id?: string;
  name: string;
  type?: string;
  keywords?: string[];
  photos?: Array<{ url: string }>;
  photo_url?: string;
}

const detailCache = new Map<string, Promise<{ photos: string[] } | null>>();

const DEFAULT_IMAGES: Record<string, string> = {
  coffee: 'nf://cover/coffee',
  restaurant: 'nf://cover/restaurant',
  bar: 'nf://cover/bar',
  bookstore: 'nf://cover/bookstore',
  default: 'nf://cover/night-city'
};

function resolveCategory(type?: string, name?: string): string {
  const t = String(type ?? '').toLowerCase();
  const n = String(name ?? '').toLowerCase();
  const text = `${t} ${n}`;
  if (text.includes('咖啡') || text.includes('cafe') || text.includes('coffee')) return 'coffee';
  if (text.includes('书店') || text.includes('book')) return 'bookstore';
  if (text.includes('酒吧') || text.includes('bar')) return 'bar';
  if (text.includes('餐') || text.includes('restaurant') || text.includes('饭')) return 'restaurant';
  return 'default';
}

async function getDetailsCached(poiId: string) {
  if (!detailCache.has(poiId)) {
    detailCache.set(poiId, (async () => {
      const details = await getPlaceDetails(poiId);
      if (!details) return null;
      return { photos: details.photos || [] };
    })());
  }
  return detailCache.get(poiId)!;
}

export async function resolveImageForPlace(place: PlaceLike): Promise<ImageResult> {
  const name = String(place?.name ?? '').trim();
  const id = String(place?.id ?? '').trim();

  // Level 1: Amap photos from search results
  const directPhoto = place?.photo_url || (place?.photos && place.photos[0]?.url);
  if (directPhoto) {
    return { url: directPhoto, source: 'amap', relevance: 'high' };
  }

  // Level 1b: Amap place details lookup
  if (id) {
    const details = await getDetailsCached(id);
    if (details?.photos?.length) {
      return { url: details.photos[0], source: 'amap', relevance: 'high' };
    }
  }

  // Level 2: Search engine image (optional)
  const keywordParts = Array.isArray(place?.keywords) && place.keywords.length
    ? place.keywords
    : [name, String(place?.type ?? '')];
  const keywordQuery = keywordParts.filter(Boolean).join(' ').trim();
  const searchUrl = await searchImage(keywordQuery || name);
  if (searchUrl) {
    return { url: searchUrl, source: 'search', relevance: 'medium' };
  }

  // Level 3: Unsplash ambiance image
  const unsplashUrl = await getImageForPlace(keywordQuery || name);
  if (unsplashUrl) {
    return { url: unsplashUrl, source: 'unsplash', relevance: 'medium' };
  }

  // Level 4: Default placeholder
  const category = resolveCategory(place?.type, name);
  return {
    url: DEFAULT_IMAGES[category] || DEFAULT_IMAGES.default,
    source: 'default',
    relevance: 'low'
  };
}

export function resolveImageFromAmap(place: AmapPlace): ImageResult | null {
  const photo = getPhotoUrl(place);
  if (!photo) return null;
  return { url: photo, source: 'amap', relevance: 'high' };
}
