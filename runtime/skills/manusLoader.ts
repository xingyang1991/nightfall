/*
  Manus skill package loader.

  - In the browser (Vite), we bundle ./packages/* via import.meta.glob.
  - In the server (tsx), we load skill packages from a directory (SkillStore).

  This dual mode lets us migrate naturally:
    client PoC  ->  server SkillStore (remote loading)
*/
import type { CandidateItem } from '../../types';

// NOTE: we keep the loader dependency-light on purpose.
// Server-side, we only use fs/path and a minimal YAML parser.
import fs from 'node:fs';
import path from 'node:path';

export interface ManusSkillPackage {
  id: string;
  displayName: string;
  shortDescription: string;
  defaultPrompt: string;
  specMarkdown: string;
  bundleContractMarkdown: string;
  exampleOutputMarkdown: string;
  referencesMarkdown: string;
  /** Raw front matter (if present). */
  meta: Record<string, string>;
  /** UI shelf tagging (optional). */
  shelfTag?: string;
}

function parseFrontMatter(md: string): { meta: Record<string, string>; body: string } {
  if (!md.startsWith('---')) return { meta: {}, body: md };
  const parts = md.split('---');
  if (parts.length < 3) return { meta: {}, body: md };
  const fm = parts[1] ?? '';
  const body = parts.slice(2).join('---').trimStart();
  const meta: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    meta[m[1]] = (m[2] ?? '').replace(/^"|"$/g, '');
  }
  return { meta, body };
}

function parseSimpleYaml(yaml: string): any {
  // Minimal parser for our openai.yaml shape (interface: { key: value }).
  const root: any = {};
  let curKey: string | null = null;
  for (const raw of yaml.split(/\r?\n/)) {
    const line = raw.replace(/\t/g, '  ').replace(/\s+$/g, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    if (/^\s/.test(line)) {
      if (!curKey) continue;
      const m = line.match(/^\s+([A-Za-z0-9_]+):\s*(.*)$/);
      if (m) {
        root[curKey] = root[curKey] ?? {};
        root[curKey][m[1]] = (m[2] ?? '').trim().replace(/^"|"$/g, '');
      }
      continue;
    }

    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    const v = (m[2] ?? '').trim();
    if (!v) {
      root[k] = {};
      curKey = k;
    } else {
      root[k] = v.replace(/^"|"$/g, '');
      curKey = null;
    }
  }
  return root;
}

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && Boolean((process as any).versions?.node);
}

function readTextSafe(p: string): string {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Server-side loader: read packages from a directory.
 * Directory structure: <dir>/<skillId>/SKILL.md + agents/openai.yaml + references/<subdirs>/*.md
 */
function loadFromDir(dir: string): ManusSkillPackage[] {
  const out: ManusSkillPackage[] = [];
  if (!fs.existsSync(dir)) return out;

  const skillIds = fs.readdirSync(dir).filter((d) => {
    const full = path.join(dir, d);
    return fs.statSync(full).isDirectory();
  });

  for (const id of skillIds) {
    const base = path.join(dir, id);
    const mdPath = path.join(base, 'SKILL.md');
    if (!fs.existsSync(mdPath)) continue;

    const md = readTextSafe(mdPath);
    const { meta } = parseFrontMatter(md);

    const openaiRaw = readTextSafe(path.join(base, 'agents', 'openai.yaml'));
    const openai = openaiRaw ? parseSimpleYaml(openaiRaw) : {};
    const iface = openai.interface ?? {};
    const bundleContract = readTextSafe(path.join(base, 'BUNDLE_CONTRACT.md'));
    const exampleOutput = readTextSafe(path.join(base, 'EXAMPLE_OUTPUT.md'));

    // Collect references/**/*.md
    const refs: string[] = [];
    const refDir = path.join(base, 'references');
    if (fs.existsSync(refDir)) {
      const stack = [refDir];
      while (stack.length) {
        const cur = stack.pop()!;
        for (const f of fs.readdirSync(cur)) {
          const fp = path.join(cur, f);
          const stat = fs.statSync(fp);
          if (stat.isDirectory()) stack.push(fp);
          else if (f.toLowerCase().endsWith('.md')) refs.push(readTextSafe(fp).trim());
        }
      }
    }

    const displayName = String(iface.display_name ?? meta.name ?? id);
    const shortDescription = String(iface.short_description ?? meta.description ?? '').trim();
    const defaultPrompt = String(iface.default_prompt ?? '').trim();

    out.push({
      id,
      displayName,
      shortDescription,
      defaultPrompt,
      specMarkdown: md,
      bundleContractMarkdown: bundleContract,
      exampleOutputMarkdown: exampleOutput,
      referencesMarkdown: refs.filter(Boolean).join('\n\n---\n\n'),
      meta
    });
  }

  return out.sort((a, b) => a.id.localeCompare(b.id));
}

/** Load Manus skill packages.
 * - Browser: from bundled ./packages/*
 * - Server: from SKILLSTORE_DIR (defaults to server/skillstore/packages)
 */
export function loadManusSkillPackages(): ManusSkillPackage[] {
  if (isNodeRuntime()) {
    const dir = process.env.SKILLSTORE_DIR
      ? path.resolve(process.env.SKILLSTORE_DIR)
      : path.resolve(process.cwd(), 'server', 'skillstore', 'packages');
    return loadFromDir(dir);
  }

  // Vite client-side PoC: eager glob so this runs synchronously at bootstrap.
  const skillMdFiles: Record<string, string> = (import.meta as any).glob('./packages/*/SKILL.md', { as: 'raw', eager: true }) as any;
  const bundleContractFiles: Record<string, string> = (import.meta as any).glob('./packages/*/BUNDLE_CONTRACT.md', { as: 'raw', eager: true }) as any;
  const exampleOutputFiles: Record<string, string> = (import.meta as any).glob('./packages/*/EXAMPLE_OUTPUT.md', { as: 'raw', eager: true }) as any;
  const openaiFiles: Record<string, string> = (import.meta as any).glob('./packages/*/agents/openai.yaml', { as: 'raw', eager: true }) as any;
  const refFiles: Record<string, string> = (import.meta as any).glob('./packages/*/references/**/*.md', { as: 'raw', eager: true }) as any;

  // Group reference md by skill id
  const refsById: Record<string, string[]> = {};
  for (const [path, raw] of Object.entries(refFiles)) {
    const m = path.match(/packages\/([^/]+)\/references\//);
    if (!m) continue;
    const id = m[1];
    refsById[id] = refsById[id] ?? [];
    refsById[id].push(String(raw ?? '').trim());
  }

  const out: ManusSkillPackage[] = [];

  for (const [path, md] of Object.entries(skillMdFiles)) {
    const m = path.match(/packages\/([^/]+)\/SKILL\.md$/);
    if (!m) continue;
    const id = m[1];
    const { meta } = parseFrontMatter(String(md ?? ''));

    const openaiRaw = openaiFiles[path.replace('/SKILL.md', '/agents/openai.yaml')] ?? openaiFiles[`./packages/${id}/agents/openai.yaml`];
    const openai = openaiRaw ? parseSimpleYaml(String(openaiRaw)) : {};
    const iface = openai.interface ?? {};
    const bundleContractRaw = bundleContractFiles[path.replace('/SKILL.md', '/BUNDLE_CONTRACT.md')] ?? bundleContractFiles[`./packages/${id}/BUNDLE_CONTRACT.md`];
    const exampleOutputRaw = exampleOutputFiles[path.replace('/SKILL.md', '/EXAMPLE_OUTPUT.md')] ?? exampleOutputFiles[`./packages/${id}/EXAMPLE_OUTPUT.md`];

    const displayName = String(iface.display_name ?? meta.name ?? id);
    const shortDescription = String(iface.short_description ?? meta.description ?? '').trim();
    const defaultPrompt = String(iface.default_prompt ?? '').trim();

    const referencesMarkdown = (refsById[id] ?? []).filter(Boolean).join('\n\n---\n\n');

    out.push({
      id,
      displayName,
      shortDescription,
      defaultPrompt,
      specMarkdown: String(md ?? ''),
      bundleContractMarkdown: String(bundleContractRaw ?? ''),
      exampleOutputMarkdown: String(exampleOutputRaw ?? ''),
      referencesMarkdown,
      meta
    });
  }

  // Stable order: by id
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export function toShelfItems(pkgs: ManusSkillPackage[]): CandidateItem[] {
  return pkgs.map((p) => ({
    id: p.id,
    tag: p.shelfTag ?? 'SKILL',
    title: p.displayName,
    desc: p.shortDescription || ''
  }));
}
