import Database from 'better-sqlite3';
import type { TicketArchive } from '../services/archiveGenerator';

export class ArchivesSqlite {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS archives (
          id VARCHAR(50) PRIMARY KEY,
          user_id VARCHAR(50),
          period_type VARCHAR(20),
          period_start DATE,
          period_end DATE,
          title VARCHAR(200),
          stats JSON,
          featured_tickets JSON,
          footprint JSON,
          share_url VARCHAR(500),
          share_code VARCHAR(20),
          is_public BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
      )
      .run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_archives_user ON archives(user_id);').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_archives_created ON archives(created_at);').run();
  }

  insert(archive: TicketArchive) {
    const stmt = this.db.prepare(
      `INSERT INTO archives (
        id, user_id, period_type, period_start, period_end, title,
        stats, featured_tickets, footprint, share_url, share_code, is_public, created_at
      ) VALUES (
        @id, @user_id, @period_type, @period_start, @period_end, @title,
        @stats, @featured_tickets, @footprint, @share_url, @share_code, @is_public, @created_at
      )`
    );
    stmt.run({
      id: archive.id,
      user_id: archive.user_id,
      period_type: archive.period.type,
      period_start: archive.period.start,
      period_end: archive.period.end,
      title: archive.title,
      stats: JSON.stringify(archive.stats),
      featured_tickets: JSON.stringify(archive.featured_tickets),
      footprint: JSON.stringify(archive.footprint),
      share_url: archive.share.share_url ?? '',
      share_code: archive.share.share_code ?? '',
      is_public: archive.share.is_public ? 1 : 0,
      created_at: archive.created_at
    });
  }

  getById(id: string) {
    const row = this.db.prepare('SELECT * FROM archives WHERE id = ?').get(id);
    if (!row) return null;
    return hydrateArchive(row as any);
  }

  listByUser(userId: string, limit = 20) {
    const rows = this.db
      .prepare('SELECT * FROM archives WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, Math.max(1, Math.min(100, limit)));
    return rows.map((r: any) => hydrateArchive(r));
  }

  updateShare(id: string, share: { share_url: string; share_code: string; is_public: boolean }) {
    const stmt = this.db.prepare(
      `UPDATE archives
        SET share_url = @share_url,
            share_code = @share_code,
            is_public = @is_public
        WHERE id = @id`
    );
    stmt.run({
      id,
      share_url: share.share_url,
      share_code: share.share_code,
      is_public: share.is_public ? 1 : 0
    });
  }
}

function hydrateArchive(row: any): TicketArchive {
  return {
    id: row.id,
    user_id: row.user_id,
    period: {
      type: row.period_type,
      start: row.period_start,
      end: row.period_end
    },
    title: row.title,
    stats: safeJson(row.stats, {}),
    featured_tickets: safeJson(row.featured_tickets, []),
    footprint: safeJson(row.footprint, []),
    share: {
      is_public: Boolean(row.is_public),
      share_url: row.share_url || undefined,
      share_code: row.share_code || undefined
    },
    created_at: row.created_at
  } as TicketArchive;
}

function safeJson(raw: string, fallback: any) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
