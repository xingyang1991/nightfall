import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log environment status at startup
console.log('[Server] Starting Nightfall backend...');
console.log('[Server] NODE_ENV:', process.env.NODE_ENV || 'not_set');
console.log('[Server] GEMINI_API_KEY present:', !!process.env.GEMINI_API_KEY);
console.log('[Server] NF_TOOL_MODE:', process.env.NF_TOOL_MODE || 'not_set');
console.log('[Server] AMAP_API_KEY present:', !!process.env.AMAP_API_KEY);

import { NightfallEngine } from '../runtime/nightfallEngine';
import { SkillRuntime } from '../runtime/skillRuntime';
import { AuditLog } from '../runtime/audit/audit';
import { AuditSqlite } from './auditSqlite';
import { ensureRemoteSkillPackages } from './skillstore/remoteLoader';
import { getPresetScenes } from '../runtime/skills/registry';
import { getPlaceDetails } from '../services/amap';
import { TicketsSqlite, type TicketRow } from './ticketsSqlite';
import { ArchivesSqlite } from './archivesSqlite';
import { generateArchive, type TicketArchivePeriod } from '../services/archiveGenerator';
import { renderSharePage } from '../services/shareRenderer';
import { getCityAtmosphere } from '../services/cityAtmosphere';
import { pingPresence } from '../services/presence';
import { moderateMoment } from '../services/momentModeration';
import { MomentsSqlite, type MomentRow } from './momentsSqlite';
import { storeMomentImage } from './momentStorage';
import { ScenesSqlite } from './scenesSqlite';
import { getBearerToken, signToken, verifyToken } from './auth';
import { rateLimit, getClientIp } from './rateLimit';

import { MotionState, TimeBand, type ContextSignals } from '../types';
import type { A2UIAction } from '../a2ui/messages';

/**
 * Production-ish backend:
 * - Frontend remains A2UI renderer.
 * - Backend owns skills execution, tool calls, and audit.
 * - SkillStore supports remote allowlisted zips with caching.
 */

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'server', 'uploads')));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  next();
});

// WebSocket
const wsClients = new Set<any>();
const atmosphereSubs = new Map<any, { lat: number; lng: number; city: string; uid: string }>();

function broadcast(message: any) {
  const payload = JSON.stringify(message);
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1) ws.send(payload);
    } catch {
      // ignore
    }
  }
}

// Diagnostic endpoint to check environment configuration
app.get('/api/diag', (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  const amapKey = process.env.AMAP_API_KEY || '';
  const toolMode = process.env.NF_TOOL_MODE || 'not_set';
  res.json({
    gemini_key_present: !!geminiKey && geminiKey.length > 10,
    gemini_key_prefix: geminiKey ? geminiKey.slice(0, 8) + '...' : 'none',
    amap_key_present: !!amapKey && amapKey.length > 10,
    amap_key_prefix: amapKey ? amapKey.slice(0, 8) + '...' : 'none',
    tool_mode: toolMode,
    node_env: process.env.NODE_ENV || 'not_set',
    timestamp: new Date().toISOString()
  });
});

// ---- Paths / config ----
const PORT = Number(process.env.PORT ?? 4000);
const AUDIT_JSONL = process.env.AUDIT_PATH ?? 'server/audit.jsonl';
const AUDIT_DB = process.env.AUDIT_DB ?? 'server/audit.sqlite';
const TICKETS_DB = process.env.TICKETS_DB ?? 'server/tickets.sqlite';
const ARCHIVES_DB = process.env.ARCHIVES_DB ?? 'server/archives.sqlite';
const MOMENTS_DB = process.env.MOMENTS_DB ?? 'server/moments.sqlite';
const SCENES_DB = process.env.SCENES_DB ?? 'server/scenes.sqlite';
const SKILLSTORE_DIR = process.env.SKILLSTORE_DIR
  ? path.resolve(process.env.SKILLSTORE_DIR)
  : path.resolve(process.cwd(), 'server', 'skillstore', 'packages');
const SKILLSTORE_CACHE = process.env.SKILLSTORE_CACHE
  ? path.resolve(process.env.SKILLSTORE_CACHE)
  : path.resolve(process.cwd(), 'server', 'skillstore', 'cache');
const SKILLSTORE_ALLOWLIST = process.env.SKILLSTORE_ALLOWLIST
  ? path.resolve(process.env.SKILLSTORE_ALLOWLIST)
  : path.resolve(process.cwd(), 'server', 'skillstore', 'allowlist.json');

function validateEnv() {
  const toolMode = String(process.env.NF_TOOL_MODE ?? 'real').toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const placesKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  const warnings: string[] = [];

  if (toolMode !== 'stub' && !geminiKey) {
    warnings.push('Missing GEMINI_API_KEY/API_KEY (skills will fall back to stub output).');
  }
  if (toolMode !== 'stub' && !placesKey) {
    warnings.push('Missing GOOGLE_PLACES_API_KEY/GOOGLE_MAPS_API_KEY (real place photos disabled).');
  }
  if (toolMode === 'replay' && !process.env.NF_TOOL_RECORD_PATH) {
    warnings.push('NF_TOOL_MODE=replay but NF_TOOL_RECORD_PATH not set; defaulting to /tmp/nf_tool_record.json.');
  }

  if (warnings.length) {
    // eslint-disable-next-line no-console
    console.warn('[nightfall] env check:');
    warnings.forEach((w) => console.warn(`- ${w}`));
  }
}

// ---- Audit ----
const audit = new AuditLog(AUDIT_JSONL);
const auditDb = new AuditSqlite(AUDIT_DB);
const ticketsDb = new TicketsSqlite(TICKETS_DB);
const archivesDb = new ArchivesSqlite(ARCHIVES_DB);
const momentsDb = new MomentsSqlite(MOMENTS_DB);
const scenesDb = new ScenesSqlite(SCENES_DB);
// Hook AuditLog.push to also append to sqlite
const origPush = audit.push.bind(audit);
audit.push = (ev: any) => {
  const withCtx = origPush(ev);
  try { auditDb.append(withCtx as any); } catch { /* ignore */ }
  return withCtx;
};

// ---- Sessions (in-memory for now) ----
type SessionRecord = {
  engine: NightfallEngine;
  runtime: SkillRuntime;
  lastContext: ContextSignals;
};
const sessions = new Map<string, SessionRecord>();

function makeSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

function makeUserId() {
  return `nf_${crypto.randomBytes(12).toString('hex')}`;
}

function makeTraceId() {
  return crypto.randomBytes(12).toString('hex');
}

function defaultContext(): ContextSignals {
  const now = new Date();
  return {
    time: {
      now_ts: now.toISOString(),
      time_band: TimeBand.PRIME,
      weekday: now.getDay() || 7,
      local_holiday_flag: false
    },
    location: {
      grid_id: 'grid_1km_unknown',
      city_id: 'Shanghai',
      place_context: 'unknown',
      location_quality: 'ok'
    },
    mobility: {
      motion_state: MotionState.STILL,
      transport_mode: 'walk',
      eta_min: 0
    },
    user_state: {
      mode: 'immersion',
      energy_band: 'mid',
      social_temp: 1,
      stealth: false
    }
  };
}

function getSession(sessionId?: string, context?: ContextSignals): { sessionId: string; rec: SessionRecord } {
  const sid = sessionId && typeof sessionId === 'string' ? sessionId : makeSessionId();
  let rec = sessions.get(sid);
  if (!rec) {
    const runtime = new SkillRuntime({ audit });
    const engine = new NightfallEngine(runtime);
    rec = { engine, runtime, lastContext: context ?? defaultContext() };
    sessions.set(sid, rec);
  }
  if (context) rec.lastContext = context;
  return { sessionId: sid, rec };
}

function authEnabled() {
  return Boolean(process.env.NF_AUTH_SECRET);
}

function pickUserId(req: any) {
  return String(req.body?.user_id ?? req.body?.userId ?? req.query?.user_id ?? req.query?.userId ?? '').trim();
}

function resolveAuth(req: any) {
  const token = getBearerToken(req.headers?.authorization);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { uid: payload.uid, token };
}

function requireAuth(req: any, res: any) {
  if (!authEnabled()) {
    const fallback = pickUserId(req);
    return { uid: fallback || 'anonymous' };
  }
  const auth = resolveAuth(req);
  if (!auth) {
    res.status(401).json({ error: 'missing_or_invalid_token' });
    return null;
  }
  return { uid: auth.uid };
}

function isAdmin(userId: string) {
  const raw = String(process.env.NF_ADMIN_USER_IDS ?? '').trim();
  if (!raw) return false;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(userId);
}

function requireAdmin(req: any, res: any) {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (authEnabled() && !isAdmin(auth.uid)) {
    res.status(403).json({ error: 'admin_only' });
    return null;
  }
  return auth;
}

const limitArchiveCreate = rateLimit({
  windowMs: 60_000,
  max: 6,
  keyFn: (req) => `archive:${getClientIp(req)}`
});

const limitMomentUpload = rateLimit({
  windowMs: 60_000,
  max: 6,
  keyFn: (req) => `moment_upload:${getClientIp(req)}`
});

const limitMomentLike = rateLimit({
  windowMs: 30_000,
  max: 20,
  keyFn: (req) => `moment_like:${getClientIp(req)}`
});

// ---- Startup: ensure remote skill packages ----
async function bootstrapSkillStore() {
  const installed = await ensureRemoteSkillPackages({
    allowlistPath: SKILLSTORE_ALLOWLIST,
    cacheDir: SKILLSTORE_CACHE,
    packagesDir: SKILLSTORE_DIR
  });
  // eslint-disable-next-line no-console
  console.log(`[nightfall] skillstore ready. localDir=${SKILLSTORE_DIR} installed=${installed.length}`);
}

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// Bootstrap: initialize all surfaces; returns messages + effects + sessionId
app.post('/api/bootstrap', async (req, res) => {
  const ctx = (req.body?.context ?? defaultContext()) as ContextSignals;
  const { sessionId, rec } = getSession(req.body?.sessionId, ctx);
  const authOn = authEnabled();
  const existingAuth = authOn ? resolveAuth(req) : null;
  const userId = authOn
    ? (existingAuth?.uid ?? makeUserId())
    : (pickUserId(req) || sessionId);
  const token = authOn ? (existingAuth?.token ?? signToken(userId)) : '';
  const traceId = makeTraceId();
  audit.setContext({ traceId, sessionId });
  const out = rec.engine.bootstrap(ctx);
  res.json({
    sessionId,
    traceId,
    messages: out.messages,
    effects: out.effects,
    userId,
    auth_enabled: authOn,
    auth_token: token
  });
});

// Action: execute a userAction; returns messages + effects
app.post('/api/action', async (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const action = req.body?.action as A2UIAction;
  if (!action?.name) return res.status(400).json({ error: 'missing action' });
  const ctx = (req.body?.context ?? defaultContext()) as ContextSignals;
  const { sessionId, rec } = getSession(req.body?.sessionId, ctx);
  const userId = auth.uid || String(req.body?.userId ?? sessionId ?? '').trim();
  const traceId = makeTraceId();
  audit.setContext({ traceId, sessionId });
  try {
    const out = await rec.engine.dispatch(action, ctx);
    if (action.name === 'SAVE_TICKET') {
      const payload = (action.payload as any) ?? {};
      const bundle = payload.bundle;
      if (bundle?.primary_ending?.title) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 5);
        const primary = bundle.primary_ending ?? {};
        const place = (primary.payload ?? {}) as any;
        const ticketId = String(payload.ticketId ?? primary.id ?? makeSessionId()).trim();
        const row: TicketRow = {
          id: ticketId,
          user_id: userId || sessionId,
          place_id: String(place.place_id ?? place.id ?? ''),
          place_name: String(place.name ?? primary.title ?? ''),
          place_address: String(place.address ?? ''),
          place_category: String(place.category ?? ''),
          image_ref: String(bundle?.media_pack?.cover_ref ?? bundle?.media_pack?.fragment_ref ?? ''),
          visit_date: dateStr,
          visit_time: timeStr,
          skill_used: String(payload.skill_id ?? ''),
          user_query: String(payload.user_query ?? ''),
          ending_narrative: String(primary.reason ?? ''),
          memory_note: String(payload.memory_note ?? ''),
          is_favorite: Boolean(payload.is_favorite ?? false),
          created_at: now.toISOString(),
          bundle_json: JSON.stringify(bundle)
        };
        ticketsDb.upsert(row);
      }
    }
    res.json({ sessionId, traceId, messages: out.messages, effects: out.effects, userId });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'error', sessionId, traceId });
  }
});

// Audit tail
app.get('/api/audit', (req, res) => {
  const n = Math.max(1, Math.min(500, Number(req.query?.n ?? 50)));
  res.json({ events: auditDb.tail(n) });
});

// Trace replay
app.get('/api/trace/:traceId', (req, res) => {
  const traceId = String(req.params.traceId ?? '').trim();
  if (!traceId) return res.status(400).json({ error: 'missing traceId' });
  const events = auditDb.byTrace(traceId);
  res.json({ traceId, events });
});

// List installed skills (for debugging UI)
app.get('/api/skills', (_req, res) => {
  const { listSkills } = require('../runtime/skills/registry');
  res.json({ skills: listSkills().map((s: any) => ({ id: s.manifest.id, title: s.manifest.title, allowedSurfaces: s.manifest.allowedSurfaces })) });
});

// Preset scenes for Discover
app.get('/api/scenes', (_req, res) => {
  const scenesPath = path.resolve(process.cwd(), 'server', 'scenes.json');
  let seedScenes = getPresetScenes();
  try {
    if (fs.existsSync(scenesPath)) {
      const raw = fs.readFileSync(scenesPath, 'utf-8');
      const scenes = JSON.parse(raw);
      if (Array.isArray(scenes)) seedScenes = scenes;
      if (Array.isArray(scenes?.scenes)) seedScenes = scenes.scenes;
    }
  } catch {
    // ignore
  }
  scenesDb.seedIfEmpty(seedScenes as any);
  const scenes = scenesDb.listActive(60);
  res.json({ scenes: scenes.length ? scenes : seedScenes });
});

// Amap place details (photos etc.)
app.get('/api/places/:id/details', async (req, res) => {
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'missing id' });
  const details = await getPlaceDetails(id);
  if (!details) return res.status(404).json({ error: 'not_found' });
  res.json(details);
});

// City atmosphere
app.get('/api/atmosphere', async (req, res) => {
  const lat = Number(req.query?.lat ?? 31.23);
  const lng = Number(req.query?.lng ?? 121.47);
  const city = String(req.query?.city ?? 'Shanghai');
  const uid = String(req.query?.uid ?? '').trim();
  const presence = uid ? await pingPresence({ userId: uid, city, lat, lng }) : null;
  const data = await getCityAtmosphere(lat, lng, city, { presence });
  res.json(data);
});

// Moments stream
app.get('/api/moments', (req, res) => {
  const limit = Math.max(1, Math.min(60, Number(req.query?.limit ?? 20)));
  const sort = (String(req.query?.sort ?? 'recent') as 'recent' | 'popular' | 'nearby') || 'recent';
  const moments = momentsDb.list({ limit, sort });
  res.json({ moments });
});

app.post('/api/moments', limitMomentUpload, (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const userId = auth.uid || String(req.body?.user_id ?? req.body?.userId ?? 'anonymous');
  const imageData = String(req.body?.image_data ?? '').trim();
  const imageInput = String(req.body?.image_url ?? imageData ?? '').trim();
  if (!imageInput) return res.status(400).json({ error: 'missing image' });

  const now = new Date().toISOString();
  const latRaw = Number(req.body?.place_lat);
  const lngRaw = Number(req.body?.place_lng);
  const placeLat = Number.isFinite(latRaw) ? latRaw : undefined;
  const placeLng = Number.isFinite(lngRaw) ? lngRaw : undefined;

  const reviewMode = String(process.env.NF_MOMENTS_REVIEW ?? '').toLowerCase() === 'true';
  const aiReview = String(process.env.NF_MOMENTS_AI_REVIEW ?? '').toLowerCase() === 'true';
  const baseStatus = reviewMode ? 'pending' : 'approved';

  storeMomentImage(imageInput)
    .then((stored) => {
      const runModeration = async () => {
        if (!aiReview) return { approved: true };
        return moderateMoment({ imageUrl: stored.url, caption: String(req.body?.caption ?? '') });
      };
      runModeration()
        .then((moderation) => {
          const status = moderation?.approved ? baseStatus : 'pending';
          const fallbackWidth = Number(req.body?.width ?? 0) || undefined;
          const fallbackHeight = Number(req.body?.height ?? 0) || undefined;
          const moment: MomentRow = {
            id: `moment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            user_id: userId,
            image_url: stored.url,
            thumbnail_url: stored.thumbnail_url || stored.url,
            image_width: stored.width ?? fallbackWidth,
            image_height: stored.height ?? fallbackHeight,
            blurhash: stored.blurhash,
            place_id: String(req.body?.place_id ?? ''),
            place_name: String(req.body?.place_name ?? ''),
            place_lat: placeLat,
            place_lng: placeLng,
            caption: String(req.body?.caption ?? ''),
            taken_at: String(req.body?.taken_at ?? now),
            uploaded_at: now,
            likes: 0,
            views: 0,
            status: status as any
          };
          momentsDb.insert(moment);
          if (status === 'approved') {
            broadcast({ type: 'moment:new', payload: moment });
          }
          res.json(moment);
        })
        .catch(() => {
          const fallbackWidth = Number(req.body?.width ?? 0) || undefined;
          const fallbackHeight = Number(req.body?.height ?? 0) || undefined;
          const moment: MomentRow = {
            id: `moment_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            user_id: userId,
            image_url: stored.url,
            thumbnail_url: stored.thumbnail_url || stored.url,
            image_width: stored.width ?? fallbackWidth,
            image_height: stored.height ?? fallbackHeight,
            blurhash: stored.blurhash,
            place_id: String(req.body?.place_id ?? ''),
            place_name: String(req.body?.place_name ?? ''),
            place_lat: placeLat,
            place_lng: placeLng,
            caption: String(req.body?.caption ?? ''),
            taken_at: String(req.body?.taken_at ?? now),
            uploaded_at: now,
            likes: 0,
            views: 0,
            status: baseStatus as any
          };
          momentsDb.insert(moment);
          if (baseStatus === 'approved') {
            broadcast({ type: 'moment:new', payload: moment });
          }
          res.json(moment);
        });
    })
    .catch((err) => {
      res.status(500).json({ error: err?.message ?? 'upload_failed' });
    });
});

app.post('/api/moments/:id/like', limitMomentLike, (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'missing id' });
  const row = momentsDb.like(id);
  res.json(row ?? { ok: true });
});

app.post('/api/moments/:id/report', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'missing id' });
  const reason = String(req.body?.reason ?? 'report').trim();
  momentsDb.report(id, reason);
  res.json({ ok: true });
});

app.post('/api/moments/:id/approve', (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'missing id' });
  momentsDb.updateStatus(id, 'approved');
  res.json({ ok: true });
});

app.post('/api/moments/:id/reject', (req, res) => {
  const auth = requireAdmin(req, res);
  if (!auth) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'missing id' });
  momentsDb.updateStatus(id, 'rejected');
  res.json({ ok: true });
});

// Ticket list by session/user
app.get('/api/tickets', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const userId = auth.uid || String((req.query?.user_id ?? req.query?.session_id ?? '') as string).trim();
  if (!userId) return res.json({ tickets: [] });
  const limit = Math.max(1, Math.min(200, Number(req.query?.limit ?? 50)));
  const tickets = ticketsDb.listByUser(userId, limit);
  res.json({ tickets });
});

// Update ticket note/favorite
app.patch('/api/tickets/:id', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'missing id' });
  const memory_note = typeof req.body?.memory_note === 'string' ? req.body.memory_note : undefined;
  const is_favorite = typeof req.body?.is_favorite === 'boolean' ? req.body.is_favorite : undefined;
  const updated = ticketsDb.updateTicketForUser(id, auth.uid, { memory_note, is_favorite });
  if (!updated) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// Generate archive
app.post('/api/archives', limitArchiveCreate, (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const userId = auth.uid || String(req.body?.user_id ?? req.body?.userId ?? req.query?.user_id ?? '').trim();
  if (!userId) return res.status(400).json({ error: 'missing user_id' });
  const period = (req.body?.period ?? {}) as TicketArchivePeriod;
  if (!period?.start || !period?.end || !period?.type) {
    return res.status(400).json({ error: 'missing period' });
  }
  const tickets = ticketsDb.listByUser(userId, 200);
  const archive = generateArchive(tickets, period, userId);
  archivesDb.insert(archive);
  res.json({ archive });
});

// List archives
app.get('/api/archives', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const userId = auth.uid || String((req.query?.user_id ?? req.query?.userId ?? '') as string).trim();
  if (!userId) return res.json({ archives: [] });
  const limit = Math.max(1, Math.min(100, Number(req.query?.limit ?? 20)));
  const archives = archivesDb.listByUser(userId, limit);
  res.json({ archives });
});

// Share archive
app.post('/api/archives/:id/share', (req, res) => {
  const auth = requireAuth(req, res);
  if (!auth) return;
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).json({ error: 'missing id' });
  const archive = archivesDb.getById(id);
  if (!archive) return res.status(404).json({ error: 'not_found' });
  if (authEnabled() && archive.user_id !== auth.uid) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
  const shareUrl = `/share/archive/${encodeURIComponent(id)}?code=${code}`;
  archivesDb.updateShare(id, { share_url: shareUrl, share_code: code, is_public: true });
  res.json({ share_url: shareUrl, share_code: code });
});

// Public share page
app.get('/share/archive/:id', (req, res) => {
  const id = String(req.params.id ?? '').trim();
  if (!id) return res.status(400).send('missing id');
  const archive = archivesDb.getById(id);
  if (!archive) return res.status(404).send('not found');
  const code = String(req.query?.code ?? '').trim();
  if (!archive.share.is_public && (!code || code !== archive.share.share_code)) {
    return res.status(403).send('forbidden');
  }
  if (archive.share.share_code && code && code !== archive.share.share_code) {
    return res.status(403).send('forbidden');
  }
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '').trim();
  const proto = String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0].trim();
  const base = host ? `${proto}://${host}` : '';
  const shareUrl = archive.share.share_url
    ? (archive.share.share_url.startsWith('http') ? archive.share.share_url : `${base}${archive.share.share_url}`)
    : '';
  const shouldPrint = String(req.query?.print ?? '') === '1';
  const finalize = async () => {
    let qrDataUrl = '';
    if (shareUrl) {
      try {
        const QRCode = await import('qrcode');
        qrDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, width: 220 });
      } catch {
        qrDataUrl = '';
      }
    }
    const html = renderSharePage(archive, { qrDataUrl, shareUrl, autoPrint: shouldPrint });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  };
  finalize().catch(() => {
    const html = renderSharePage(archive, { shareUrl, autoPrint: shouldPrint });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });
});

// Proxy Google Places Photo (avoids leaking API key to client)
app.get('/api/places/photo', async (req, res) => {
  const ref = String(req.query?.ref ?? '').trim();
  if (!ref) return res.status(400).json({ error: 'missing ref' });
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(501).json({ error: 'missing GOOGLE_PLACES_API_KEY' });
  const maxw = Math.max(200, Math.min(1600, Number(req.query?.maxw ?? 900)));
  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxw}&photo_reference=${encodeURIComponent(ref)}&key=${key}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).send(`places photo failed: ${r.status}`);
    const contentType = r.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await r.arrayBuffer());
    res.end(buf);
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? 'photo_fetch_failed' });
  }
});

// SPA fallback for frontend routing (must be after API routes)
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '..', 'dist');
  app.get('*', (req, res) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// Start server
bootstrapSkillStore()
  .then(() => {
    validateEnv();
    const server = app.listen(PORT, '0.0.0.0', () => {
      // eslint-disable-next-line no-console
      console.log(`[nightfall] backend listening on http://0.0.0.0:${PORT}`);
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
      wsClients.add(ws);
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw));
          if (msg?.type === 'subscribe:atmosphere') {
            const lat = Number(msg?.lat ?? 31.23);
            const lng = Number(msg?.lng ?? 121.47);
            const city = String(msg?.city ?? 'Shanghai');
            const token = String(msg?.token ?? '').trim();
            const verified = token ? verifyToken(token) : null;
            const uid = verified?.uid || String(msg?.uid ?? '').trim() || makeUserId();
            atmosphereSubs.set(ws, { lat, lng, city, uid });
            try {
              pingPresence({ userId: uid, city, lat, lng }).then((presence) => {
                if (presence && ws.readyState === 1) {
                  ws.send(JSON.stringify({ type: 'user:nearby', payload: presence }));
                }
              });
            } catch {
              // ignore
            }
          }
          if (msg?.type === 'unsubscribe:atmosphere') {
            atmosphereSubs.delete(ws);
          }
        } catch {
          // ignore
        }
      });
      ws.on('close', () => {
        wsClients.delete(ws);
        atmosphereSubs.delete(ws);
      });
    });

    setInterval(async () => {
      for (const [ws, sub] of atmosphereSubs.entries()) {
        try {
          const presence = await pingPresence({ userId: sub.uid, city: sub.city, lat: sub.lat, lng: sub.lng });
          const data = await getCityAtmosphere(sub.lat, sub.lng, sub.city, { presence });
          const payload = JSON.stringify({ type: 'atmosphere:update', payload: data });
          if (ws.readyState === 1) ws.send(payload);
          if (presence && ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'user:nearby', payload: presence }));
          }
        } catch {
          // ignore
        }
      }
    }, 120000);
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[nightfall] failed to bootstrap skillstore', e);
    process.exit(1);
  });
