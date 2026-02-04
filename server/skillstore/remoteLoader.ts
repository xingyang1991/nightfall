import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

export interface SkillAllowlistEntry {
  id: string;
  version: string;
  url: string;
  sha256: string;
}

export interface RemoteSkillstoreConfig {
  allowlistPath: string;
  cacheDir: string;
  packagesDir: string;
}

function sha256File(fp: string): string {
  const h = crypto.createHash('sha256');
  const buf = fs.readFileSync(fp);
  h.update(buf);
  return h.digest('hex');
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function downloadTo(url: string, outPath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  const ab = await res.arrayBuffer();
  fs.writeFileSync(outPath, Buffer.from(ab));
}

/**
 * Remote SkillStore loader:
 * - reads allowlist.json
 * - downloads zip to cache (by id+version)
 * - verifies sha256
 * - extracts into packagesDir/<id>
 *
 * This is intentionally strict: only allowlisted, version-locked artifacts.
 */
export async function ensureRemoteSkillPackages(cfg: RemoteSkillstoreConfig): Promise<string[]> {
  ensureDir(cfg.cacheDir);
  ensureDir(cfg.packagesDir);

  if (!fs.existsSync(cfg.allowlistPath)) return [];
  const raw = fs.readFileSync(cfg.allowlistPath, 'utf-8');
  const list: SkillAllowlistEntry[] = JSON.parse(raw);
  const installed: string[] = [];

  for (const e of list) {
    if (!e?.id || !e?.version || !e?.url || !e?.sha256) continue;
    const zipName = `${e.id}__${e.version}.zip`;
    const zipPath = path.join(cfg.cacheDir, zipName);
    const marker = path.join(cfg.cacheDir, `${e.id}__${e.version}.installed`);

    // Download if missing
    if (!fs.existsSync(zipPath)) {
      await downloadTo(e.url, zipPath);
    }

    // Verify sha256
    const got = sha256File(zipPath);
    if (got !== e.sha256.toLowerCase()) {
      throw new Error(`sha256 mismatch for ${e.id}@${e.version}: expected ${e.sha256}, got ${got}`);
    }

    // Extract only once per version
    if (!fs.existsSync(marker)) {
      const tmp = path.join(cfg.cacheDir, `${e.id}__${e.version}__tmp`);
      fs.rmSync(tmp, { recursive: true, force: true });
      ensureDir(tmp);
      // Use system unzip for simplicity (PoC). In production, use a safe zip lib.
      execSync(`unzip -q "${zipPath}" -d "${tmp}"`);

      // Heuristic: zip may include a top-level folder. We want packagesDir/<id>/...
      const entries = fs.readdirSync(tmp);
      const root = entries.length === 1 && fs.statSync(path.join(tmp, entries[0])).isDirectory()
        ? path.join(tmp, entries[0])
        : tmp;

      const dest = path.join(cfg.packagesDir, e.id);
      fs.rmSync(dest, { recursive: true, force: true });
      ensureDir(dest);
      // Copy recursively
      copyDir(root, dest);
      fs.writeFileSync(marker, new Date().toISOString());
    }

    installed.push(`${e.id}@${e.version}`);
  }

  return installed;
}

function copyDir(src: string, dest: string) {
  ensureDir(dest);
  for (const name of fs.readdirSync(src)) {
    const sp = path.join(src, name);
    const dp = path.join(dest, name);
    const st = fs.statSync(sp);
    if (st.isDirectory()) copyDir(sp, dp);
    else fs.copyFileSync(sp, dp);
  }
}
