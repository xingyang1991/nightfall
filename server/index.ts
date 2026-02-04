import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import crypto from 'node:crypto';

import { NightfallEngine } from '../runtime/nightfallEngine';
import { SkillRuntime } from '../runtime/skillRuntime';
import { AuditLog } from '../runtime/audit/audit';
import { AuditSqlite } from './auditSqlite';
import { ensureRemoteSkillPackages } from './skillstore/remoteLoader';

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
app.use(express.json({ limit: '2mb' }));

// ---- Paths / config ----
const PORT = Number(process.env.PORT ?? 4000);
const AUDIT_JSONL = process.env.AUDIT_PATH ?? 'server/audit.jsonl';
const AUDIT_DB = process.env.AUDIT_DB ?? 'server/audit.sqlite';
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
  const traceId = makeTraceId();
  audit.setContext({ traceId, sessionId });
  const out = rec.engine.bootstrap(ctx);
  res.json({ sessionId, traceId, messages: out.messages, effects: out.effects });
});

// Action: execute a userAction; returns messages + effects
app.post('/api/action', async (req, res) => {
  const action = req.body?.action as A2UIAction;
  if (!action?.name) return res.status(400).json({ error: 'missing action' });
  const ctx = (req.body?.context ?? defaultContext()) as ContextSignals;
  const { sessionId, rec } = getSession(req.body?.sessionId, ctx);
  const traceId = makeTraceId();
  audit.setContext({ traceId, sessionId });
  try {
    const out = await rec.engine.dispatch(action, ctx);
    res.json({ sessionId, traceId, messages: out.messages, effects: out.effects });
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
    app.listen(PORT, '0.0.0.0', () => {
      // eslint-disable-next-line no-console
      console.log(`[nightfall] backend listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[nightfall] failed to bootstrap skillstore', e);
    process.exit(1);
  });
