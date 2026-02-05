import type { TicketRow } from '../server/ticketsSqlite';

export interface TicketArchivePeriod {
  type: 'month' | 'year' | 'custom';
  start: string;
  end: string;
}

export interface TicketArchive {
  id: string;
  user_id: string;
  period: TicketArchivePeriod;
  title: string;
  stats: {
    total_trips: number;
    total_places: number;
    total_distance: number;
    favorite_category: string;
    most_visited_area: string;
    night_owl_score: number;
  };
  featured_tickets: Array<{
    ticket_id: string;
    place_name: string;
    date: string;
    image_ref: string;
    memory_note?: string;
  }>;
  footprint: Array<{
    lat: number;
    lng: number;
    place_name: string;
    visit_count: number;
  }>;
  share: {
    is_public: boolean;
    share_url?: string;
    share_code?: string;
  };
  created_at: string;
}

export function generateArchive(
  tickets: TicketRow[],
  period: TicketArchivePeriod,
  userId: string
): TicketArchive {
  const filtered = tickets.filter((t) => {
    if (!t.visit_date) return false;
    const d = new Date(t.visit_date);
    return d >= new Date(period.start) && d <= new Date(period.end);
  });

  const stats = calculateStats(filtered);
  const featured_tickets = selectFeaturedTickets(filtered, 6);
  const footprint = generateFootprint(filtered);
  const title = generateTitle(period);

  return {
    id: generateId(),
    user_id: userId,
    period,
    title,
    stats,
    featured_tickets,
    footprint,
    share: {
      is_public: false
    },
    created_at: new Date().toISOString()
  };
}

function calculateStats(tickets: TicketRow[]): TicketArchive['stats'] {
  const categories = tickets.map((t) => t.place_category || '未知');
  const categoryCount = countOccurrences(categories);
  const favoriteCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知';

  const places = new Set(
    tickets
      .map((t) => t.place_id || t.place_name)
      .filter(Boolean)
  );

  const nightOwlScore = calculateNightOwlScore(tickets);

  return {
    total_trips: tickets.length,
    total_places: places.size,
    total_distance: 0,
    favorite_category: favoriteCategory,
    most_visited_area: inferMostVisitedArea(tickets),
    night_owl_score: nightOwlScore
  };
}

function countOccurrences(arr: string[]) {
  const counts: Record<string, number> = {};
  for (const item of arr) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

function calculateNightOwlScore(tickets: TicketRow[]): number {
  if (!tickets.length) return 0;
  let nightCount = 0;
  for (const t of tickets) {
    const time = t.visit_time || '';
    const hour = Number(time.split(':')[0] ?? NaN);
    if (Number.isFinite(hour) && (hour >= 22 || hour < 5)) nightCount += 1;
  }
  return Math.round((nightCount / tickets.length) * 100);
}

function inferMostVisitedArea(tickets: TicketRow[]): string {
  const areas = tickets
    .map((t) => t.place_address)
    .filter(Boolean)
    .map((addr) => String(addr ?? '').split(' ').slice(0, 1).join(''))
    .filter(Boolean);
  const counts = countOccurrences(areas);
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '未知';
}

function selectFeaturedTickets(tickets: TicketRow[], max: number) {
  const sorted = [...tickets].sort((a, b) => {
    const favDiff = Number(b.is_favorite) - Number(a.is_favorite);
    if (favDiff !== 0) return favDiff;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });

  return sorted.slice(0, max).map((t) => ({
    ticket_id: t.id,
    place_name: t.place_name || t.place_id || '未知',
    date: t.visit_date || '',
    image_ref: t.image_ref || '',
    memory_note: t.memory_note || undefined
  }));
}

function generateFootprint(tickets: TicketRow[]): TicketArchive['footprint'] {
  const counter = new Map<string, { lat: number; lng: number; place_name: string; visit_count: number }>();

  for (const t of tickets) {
    const raw = t.bundle_json ? safeParse(t.bundle_json) : null;
    const payload = raw?.primary_ending?.payload ?? {};
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    const placeName = String(payload.name ?? t.place_name ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const key = `${lat.toFixed(5)}_${lng.toFixed(5)}_${placeName}`;
    if (!counter.has(key)) {
      counter.set(key, { lat, lng, place_name: placeName, visit_count: 1 });
    } else {
      const existing = counter.get(key)!;
      existing.visit_count += 1;
    }
  }

  return Array.from(counter.values()).slice(0, 40);
}

function generateTitle(period: TicketArchivePeriod): string {
  if (period.type === 'year') {
    const year = new Date(period.start).getFullYear();
    return `我的${year}深夜漫游图鉴`;
  }
  if (period.type === 'month') {
    const date = new Date(period.start);
    return `${date.getFullYear()}年${date.getMonth() + 1}月・夜行记`;
  }
  return '深夜漫游回忆录';
}

function generateId(): string {
  return `arch_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function safeParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
