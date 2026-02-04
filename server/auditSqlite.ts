import Database from 'better-sqlite3';

import type { AuditEvent } from '../runtime/audit/audit';

/**
 * Minimal SQLite persistence for audit events.
 * - Append-only table
 * - Query by traceId for replay
 */
export class AuditSqlite {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS audit_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT NOT NULL,
          trace_id TEXT,
          session_id TEXT,
          type TEXT NOT NULL,
          payload TEXT NOT NULL
        );`
      )
      .run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_events(trace_id);').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_events(ts);').run();
  }

  append(ev: AuditEvent) {
    const stmt = this.db.prepare(
      'INSERT INTO audit_events (ts, trace_id, session_id, type, payload) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(ev.ts, ev.traceId ?? null, ev.sessionId ?? null, ev.type, JSON.stringify(ev));
  }

  tail(n: number): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT payload FROM audit_events ORDER BY id DESC LIMIT ?')
      .all(Math.max(1, Math.min(500, n)));
    return rows.reverse().map((r: any) => JSON.parse(r.payload));
  }

  byTrace(traceId: string): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT payload FROM audit_events WHERE trace_id = ? ORDER BY id ASC')
      .all(traceId);
    return rows.map((r: any) => JSON.parse(r.payload));
  }
}
