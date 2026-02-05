import Database from 'better-sqlite3';

export interface MomentRow {
  id: string;
  user_id: string;
  image_url: string;
  thumbnail_url?: string;
  image_width?: number;
  image_height?: number;
  blurhash?: string;
  place_id?: string;
  place_name?: string;
  place_lat?: number;
  place_lng?: number;
  caption?: string;
  taken_at?: string;
  uploaded_at?: string;
  likes?: number;
  views?: number;
  status?: 'pending' | 'approved' | 'rejected';
}

export class MomentsSqlite {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS moments (
          id VARCHAR(50) PRIMARY KEY,
          user_id VARCHAR(50),
          image_url TEXT NOT NULL,
          thumbnail_url TEXT,
          image_width INT,
          image_height INT,
          blurhash VARCHAR(100),
          place_id VARCHAR(50),
          place_name VARCHAR(200),
          place_lat DECIMAL(10,7),
          place_lng DECIMAL(10,7),
          caption TEXT,
          taken_at TIMESTAMP,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          likes INT DEFAULT 0,
          views INT DEFAULT 0,
          status VARCHAR(20) DEFAULT 'approved'
        );`
      )
      .run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_moments_status ON moments(status);').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_moments_uploaded ON moments(uploaded_at);').run();
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS moment_reports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          moment_id VARCHAR(50),
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
      )
      .run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_reports_moment ON moment_reports(moment_id);').run();
  }

  insert(moment: MomentRow) {
    const stmt = this.db.prepare(
      `INSERT INTO moments (
        id, user_id, image_url, thumbnail_url, image_width, image_height, blurhash,
        place_id, place_name, place_lat, place_lng, caption, taken_at, uploaded_at,
        likes, views, status
      ) VALUES (
        @id, @user_id, @image_url, @thumbnail_url, @image_width, @image_height, @blurhash,
        @place_id, @place_name, @place_lat, @place_lng, @caption, @taken_at, @uploaded_at,
        @likes, @views, @status
      )`
    );
    stmt.run({
      ...moment,
      likes: moment.likes ?? 0,
      views: moment.views ?? 0,
      status: moment.status ?? 'approved'
    });
  }

  list(params: { limit: number; sort: 'recent' | 'popular' | 'nearby' }): MomentRow[] {
    const limit = Math.max(1, Math.min(200, params.limit));
    if (params.sort === 'popular') {
      return this.db
        .prepare('SELECT * FROM moments WHERE status = ? ORDER BY likes DESC, uploaded_at DESC LIMIT ?')
        .all('approved', limit) as MomentRow[];
    }
    return this.db
      .prepare('SELECT * FROM moments WHERE status = ? ORDER BY uploaded_at DESC LIMIT ?')
      .all('approved', limit) as MomentRow[];
  }

  like(id: string) {
    this.db.prepare('UPDATE moments SET likes = likes + 1 WHERE id = ?').run(id);
    const row = this.db.prepare('SELECT * FROM moments WHERE id = ?').get(id);
    return row as MomentRow | undefined;
  }

  report(id: string, reason: string) {
    this.db.prepare('INSERT INTO moment_reports (moment_id, reason) VALUES (?, ?)').run(id, reason);
    this.db.prepare('UPDATE moments SET status = ? WHERE id = ?').run('pending', id);
  }

  updateStatus(id: string, status: 'approved' | 'rejected' | 'pending') {
    this.db.prepare('UPDATE moments SET status = ? WHERE id = ?').run(status, id);
  }
}
