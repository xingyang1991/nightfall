import type { ToolName } from '../contracts';
import type { AuditLog } from '../audit/audit';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { resolveTools, getToolMode, type ToolImplementations, type ToolMode } from './tools';

export class ToolBus {
  private allowed: Set<ToolName>;
  private impl: ToolImplementations;
  private audit?: AuditLog;
  private session?: Record<string, any>;
  private mode: ToolMode;
  private recorder: ToolRecorder;

  constructor(opts: { allowedTools: ToolName[]; audit?: AuditLog; impl?: ToolImplementations; session?: Record<string, any>; mode?: ToolMode }) {
    this.allowed = new Set(opts.allowedTools);
    this.audit = opts.audit;
    this.mode = opts.mode ?? getToolMode();
    this.impl = opts.impl ?? resolveTools(this.mode);
    this.session = opts.session;
    this.recorder = new ToolRecorder(this.mode);
  }

  private ensureAllowed(tool: ToolName) {
    if (!this.allowed.has(tool)) {
      throw new Error(`Tool not allowed: ${tool}`);
    }
  }

  private async call<T>(tool: ToolName, args: any, fn: () => Promise<T>): Promise<T> {
    this.ensureAllowed(tool);
    const replayed = this.recorder.replay<T>(tool, args);
    if (replayed !== undefined) {
      this.audit?.push({ type: 'tool_call', ts: new Date().toISOString(), tool, ok: true, duration_ms: 0, argsSummary: summarizeArgs(args), replay: true } as any);
      return replayed;
    }
    const t0 = performance.now();
    try {
      const out = await fn();
      this.recorder.record(tool, args, out);
      const dt = performance.now() - t0;
      this.audit?.push({ type: 'tool_call', ts: new Date().toISOString(), tool, ok: true, duration_ms: Math.round(dt), argsSummary: summarizeArgs(args) });
      return out;
    } catch (e: any) {
      const dt = performance.now() - t0;
      this.audit?.push({ type: 'tool_call', ts: new Date().toISOString(), tool, ok: false, duration_ms: Math.round(dt), argsSummary: summarizeArgs(args) });
      throw e;
    }
  }

  async placesSearch(args: { query: string; grid_id?: string; time_window?: string }) {
    const out = await this.call('places.search', args, () => this.impl.places.search(args));
    if (this.session) {
      this.session.lastPlaces = Array.isArray(out) ? out : [];
    }
    return out;
  }

  async mapsLink(args: { query: string }) {
    return this.call('maps.link', args, () => this.impl.maps.link(args));
  }

  async mapsArrivalGlance(args: { place_title?: string; query?: string; transport_mode?: string }) {
    return this.call('maps.arrival_glance', args, () => this.impl.maps.arrivalGlance(args));
  }

  async mapsSendToCar(args: { url: string }) {
    return this.call('maps.send_to_car', args, () => this.impl.maps.sendToCar(args));
  }

  async weatherForecast(args: { grid_id?: string; days?: number }) {
    return this.call('weather.forecast', args, () => this.impl.weather.forecast(args));
  }

  async pocketAppend(args: { ticket: any }) {
    return this.call('storage.pocket.append', { kind: 'ticket' }, () => this.impl.storage.pocketAppend(args));
  }

  async whispersAppend(args: { note: any }) {
    return this.call('storage.whispers.append', { kind: 'note' }, () => this.impl.storage.whispersAppend(args));
  }
}

function summarizeArgs(args: any) {
  try {
    const s = JSON.stringify(args);
    return s.length > 180 ? s.slice(0, 176) + '…' : s;
  } catch {
    return String(args);
  }
}

function isNodeRuntime() {
  return typeof process !== 'undefined' && Boolean((process as any).versions?.node);
}

type ToolRecordEntry = { tool: ToolName; args: any; result: any; ts: string };

class ToolRecorder {
  private mode: ToolMode;
  private enabled: boolean;
  private loaded = false;
  private recordPath: string;
  private records: Record<string, ToolRecordEntry> = {};

  constructor(mode: ToolMode) {
    this.mode = mode;
    this.enabled = isNodeRuntime() && (mode === 'record' || mode === 'replay');
    const envPath = isNodeRuntime() ? String((process as any).env?.NF_TOOL_RECORD_PATH ?? '').trim() : '';
    this.recordPath = envPath || '/tmp/nf_tool_record.json';
  }

  replay<T>(tool: ToolName, args: any): T | undefined {
    if (!this.enabled || this.mode !== 'replay') return undefined;
    this.load();
    const key = this.key(tool, args);
    return this.records[key]?.result as T | undefined;
  }

  record<T>(tool: ToolName, args: any, result: T) {
    if (!this.enabled || this.mode !== 'record') return;
    this.load();
    const key = this.key(tool, args);
    this.records[key] = { tool, args, result, ts: new Date().toISOString() };
    this.save();
  }

  private load() {
    if (!this.enabled || this.loaded) return;
    this.loaded = true;
    try {
      const raw = fs.readFileSync(this.recordPath, 'utf-8');
      const json = JSON.parse(raw);
      if (json && typeof json === 'object' && json.records) {
        this.records = json.records as Record<string, ToolRecordEntry>;
      }
    } catch {
      this.records = {};
    }
  }

  private save() {
    if (!this.enabled) return;
    try {
      fs.mkdirSync(path.dirname(this.recordPath), { recursive: true });
      const payload = { version: 1, records: this.records };
      fs.writeFileSync(this.recordPath, JSON.stringify(payload, null, 2));
    } catch {
      // ignore
    }
  }

  private key(tool: ToolName, args: any) {
    const raw = `${tool}:${JSON.stringify(args ?? {})}`;
    return crypto.createHash('sha1').update(raw).digest('hex');
  }
}
