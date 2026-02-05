import Database from 'better-sqlite3';

export interface TicketRow {
  id: string;
  user_id: string;
  place_id?: string;
  place_name?: string;
  place_address?: string;
  place_category?: string;
  image_ref?: string;
  visit_date?: string;
  visit_time?: string;
  skill_used?: string;
  user_query?: string;
  ending_narrative?: string;
  memory_note?: string;
  is_favorite?: boolean;
  created_at?: string;
  bundle_json?: string;
}

export class TicketsSqlite {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS tickets (
          id VARCHAR(50) PRIMARY KEY,
          user_id VARCHAR(50),
          place_id VARCHAR(50),
          place_name VARCHAR(200),
          place_address TEXT,
          place_category VARCHAR(50),
          image_ref TEXT,
          visit_date DATE,
          visit_time TIME,
          skill_used VARCHAR(50),
          user_query TEXT,
          ending_narrative TEXT,
          memory_note TEXT,
          is_favorite BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          bundle_json TEXT
        );`
      )
      .run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);').run();
  }

  upsert(ticket: TicketRow) {
    const stmt = this.db.prepare(
      `INSERT INTO tickets (
          id, user_id, place_id, place_name, place_address, place_category,
          image_ref, visit_date, visit_time, skill_used, user_query,
          ending_narrative, memory_note, is_favorite, created_at, bundle_json
        ) VALUES (
          @id, @user_id, @place_id, @place_name, @place_address, @place_category,
          @image_ref, @visit_date, @visit_time, @skill_used, @user_query,
          @ending_narrative, @memory_note, @is_favorite, @created_at, @bundle_json
        )
        ON CONFLICT(id) DO UPDATE SET
          user_id=excluded.user_id,
          place_id=excluded.place_id,
          place_name=excluded.place_name,
          place_address=excluded.place_address,
          place_category=excluded.place_category,
          image_ref=excluded.image_ref,
          visit_date=excluded.visit_date,
          visit_time=excluded.visit_time,
          skill_used=excluded.skill_used,
          user_query=excluded.user_query,
          ending_narrative=excluded.ending_narrative,
          memory_note=excluded.memory_note,
          is_favorite=excluded.is_favorite,
          bundle_json=excluded.bundle_json`
    );
    stmt.run({
      ...ticket,
      is_favorite: ticket.is_favorite ? 1 : 0
    });
  }

  listByUser(userId: string, limit = 50): TicketRow[] {
    const rows = this.db
      .prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(userId, Math.max(1, Math.min(200, limit)));
    return rows as TicketRow[];
  }

  updateTicket(id: string, patch: { memory_note?: string; is_favorite?: boolean }) {
    const stmt = this.db.prepare(
      `UPDATE tickets
        SET memory_note = COALESCE(@memory_note, memory_note),
            is_favorite = COALESCE(@is_favorite, is_favorite)
        WHERE id = @id`
    );
    stmt.run({
      id,
      memory_note: patch.memory_note ?? null,
      is_favorite: patch.is_favorite === undefined ? null : (patch.is_favorite ? 1 : 0)
    });
  }

  updateTicketForUser(id: string, userId: string, patch: { memory_note?: string; is_favorite?: boolean }) {
    const stmt = this.db.prepare(
      `UPDATE tickets
        SET memory_note = COALESCE(@memory_note, memory_note),
            is_favorite = COALESCE(@is_favorite, is_favorite)
        WHERE id = @id AND user_id = @user_id`
    );
    const info = stmt.run({
      id,
      user_id: userId,
      memory_note: patch.memory_note ?? null,
      is_favorite: patch.is_favorite === undefined ? null : (patch.is_favorite ? 1 : 0)
    });
    return info.changes > 0;
  }
}
