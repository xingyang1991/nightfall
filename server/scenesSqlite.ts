import Database from 'better-sqlite3';
import type { SceneCard } from '../runtime/skills/registry';

export class ScenesSqlite {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS scenes (
          id VARCHAR(50) PRIMARY KEY,
          title VARCHAR(100) NOT NULL,
          subtitle VARCHAR(200),
          preset_query TEXT NOT NULL,
          skill_id VARCHAR(50),
          image_ref TEXT,
          gradient VARCHAR(100),
          icon VARCHAR(10),
          tags JSON,
          sort_order INT DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`
      )
      .run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_scenes_active ON scenes(is_active, sort_order);').run();
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(1) as cnt FROM scenes').get() as any;
    return Number(row?.cnt ?? 0);
  }

  seedIfEmpty(scenes: SceneCard[]) {
    if (this.count() > 0) return;
    const insert = this.db.prepare(
      `INSERT INTO scenes (
        id, title, subtitle, preset_query, skill_id, image_ref, gradient, icon, tags, sort_order, is_active
      ) VALUES (
        @id, @title, @subtitle, @preset_query, @skill_id, @image_ref, @gradient, @icon, @tags, @sort_order, @is_active
      )`
    );
    const tx = this.db.transaction((items: SceneCard[]) => {
      items.forEach((scene, idx) => {
        insert.run({
          id: scene.id,
          title: scene.title,
          subtitle: scene.subtitle ?? '',
          preset_query: scene.preset_query,
          skill_id: scene.skill_id ?? '',
          image_ref: scene.image_ref ?? '',
          gradient: scene.gradient ?? '',
          icon: scene.icon ?? '',
          tags: JSON.stringify(scene.tags ?? []),
          sort_order: idx,
          is_active: 1
        });
      });
    });
    tx(scenes);
  }

  listActive(limit = 50): SceneCard[] {
    const rows = this.db
      .prepare('SELECT * FROM scenes WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC LIMIT ?')
      .all(Math.max(1, Math.min(200, limit))) as any[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle ?? '',
      preset_query: row.preset_query ?? '',
      skill_id: row.skill_id ?? '',
      image_ref: row.image_ref ?? '',
      gradient: row.gradient ?? '',
      icon: row.icon ?? '',
      tags: safeJson(row.tags, [])
    }));
  }
}

function safeJson(raw: string, fallback: any) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
