import type { ToolName } from '../contracts';

export type AuditEvent =
  | { type: 'skill_start'; ts: string; skillId: string; intent: string; stage: string; requestSummary: string; traceId?: string; sessionId?: string }
  | { type: 'skill_end'; ts: string; skillId: string; ok: boolean; duration_ms: number; outputSummary: string; traceId?: string; sessionId?: string }
  | { type: 'tool_call'; ts: string; tool: ToolName; ok: boolean; duration_ms: number; argsSummary: string; traceId?: string; sessionId?: string }
  | { type: 'policy_clip'; ts: string; field: string; before: number; after: number; note?: string; traceId?: string; sessionId?: string }
  | { type: 'policy_violation'; ts: string; code: string; detail: string; traceId?: string; sessionId?: string };

export class AuditLog {
  private max = 200;
  private events: AuditEvent[] = [];
  private auditPath: string | null = null;
  private ctx: { traceId?: string; sessionId?: string } = {};

  constructor(auditPath?: string) {
    // If provided, append JSONL to disk (server-side).
    this.auditPath = auditPath ?? null;
  }

  /** Set per-request context so pushes include traceId/sessionId automatically. */
  setContext(ctx: { traceId?: string; sessionId?: string }) {
    this.ctx = ctx ?? {};
  }

  push(ev: AuditEvent): AuditEvent {
    // Inject trace context if not already present
    const withCtx: AuditEvent = {
      ...ev,
      traceId: (ev as any).traceId ?? this.ctx.traceId,
      sessionId: (ev as any).sessionId ?? this.ctx.sessionId
    };
    this.events.push(withCtx);
    if (this.events.length > this.max) this.events.splice(0, this.events.length - this.max);

    // Best-effort JSONL persistence in Node runtime.
    if (this.auditPath && typeof process !== 'undefined' && (process as any).versions?.node) {
      try {
        // Lazy import to avoid bundling fs in browser.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require('node:fs');
        fs.appendFileSync(this.auditPath, JSON.stringify(withCtx) + "\n");
      } catch {
        // ignore
      }
    }
    return withCtx;
  }

  all(): AuditEvent[] {
    return [...this.events];
  }

  tail(n: number): AuditEvent[] {
    const k = Math.max(1, Math.min(this.events.length, n));
    return this.events.slice(this.events.length - k);
  }

  clear() {
    this.events = [];
  }
}
