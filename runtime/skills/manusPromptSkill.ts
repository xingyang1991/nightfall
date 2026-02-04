import type { Skill } from './skill';
import type { SkillContext, SkillManifest, SkillRequest, SkillResult } from '../contracts';
import type { ToolBus } from '../toolbus/toolBus';
import type { CandidateItem } from '../../types';
import { enforceCandidatePolicy } from '../policy/candidatePolicy';
import { generateCandidatePoolWithGemini, generateCuratorialBundleWithGemini } from '../../services/gemini';
import type { ManusSkillPackage } from './manusLoader';

/** Optional per-skill overrides (category tags, permissions, etc.) */
export interface ManusSkillOverride {
  shelfTag?: string;
  intents?: SkillManifest['intents'];
  stages?: SkillManifest['stages'];
  allowedSurfaces?: string[];
  permissions?: SkillManifest['permissions'];
  uiHints?: SkillManifest['uiHints'];
}

export function makeManusPromptSkill(pkg: ManusSkillPackage, override?: ManusSkillOverride): Skill {
  const manifest: SkillManifest = {
    id: pkg.id,
    version: '0.1.0',
    title: pkg.displayName,
    description: pkg.shortDescription || (pkg.meta?.description ?? ''),
    shelfTag: override?.shelfTag ?? pkg.shelfTag,
    defaultPrompt: pkg.defaultPrompt || undefined,
    stages: override?.stages ?? ['candidate', 'finalize'],
    intents: override?.intents ?? ['explore', 'place_anchor', 'tonight_answer'],
    allowedSurfaces: override?.allowedSurfaces ?? ['tonight', 'discover', 'pocket', 'radio'],
    permissions: override?.permissions ?? { tools: [], dataScopes: ['context.read'] },
    rateLimit: { perNight: 40, perMinute: 12 },
    uiHints: override?.uiHints ?? { toneTags: ['minimal'] }
  };

  async function runCandidate(req: SkillRequest, ctx: SkillContext, tools: ToolBus): Promise<SkillResult> {
    // Optionally seed with tool results (kept tiny in PoC)
    let toolSeeds: any[] = [];
    if (manifest.permissions.tools.includes('places.search')) {
      try {
        toolSeeds = await tools.placesSearch({ query: req.utterance ?? pkg.defaultPrompt ?? pkg.displayName, grid_id: ctx.context.location.grid_id });
      } catch {
        toolSeeds = [];
      }
    }

    const prompt = buildPrompt({
      pkg,
      ctx,
      req,
      stage: 'candidate',
      toolSeeds
    });

    const data = await generateCandidatePoolWithGemini(prompt);
    const candidates = enforceCandidatePolicy(data.candidate_pool ?? []);

    return {
      candidates,
      ui: data.ui ?? undefined,
      debug: { skill: pkg.id, stage: 'candidate' }
    };
  }

  async function runFinalize(req: SkillRequest, ctx: SkillContext, tools: ToolBus): Promise<SkillResult> {
    let toolSeeds: any[] = [];
    if (manifest.permissions.tools.includes('places.search')) {
      try {
        toolSeeds = await tools.placesSearch({ query: req.utterance ?? pkg.defaultPrompt ?? pkg.displayName, grid_id: ctx.context.location.grid_id });
      } catch {
        toolSeeds = [];
      }
    }

    const prompt = buildPrompt({
      pkg,
      ctx,
      req,
      stage: 'finalize',
      toolSeeds
    });

    const bundle = await generateCuratorialBundleWithGemini(prompt);

    return {
      bundle,
      ui: (bundle as any).ui_hints ?? undefined,
      debug: { skill: pkg.id, stage: 'finalize' }
    };
  }

  const skill: Skill = {
    manifest,
    async run(req: SkillRequest, ctx: SkillContext, tools: ToolBus): Promise<SkillResult> {
      if (req.stage === 'candidate') return runCandidate(req, ctx, tools);
      return runFinalize(req, ctx, tools);
    }
  };

  // Attach search text for router ranking (non-exported internal metadata).
  (skill as any).__searchText = buildSkillSearchText(pkg);
  (skill as any).__pkg = pkg;

  return skill;
}

function compactText(input: string, maxLen: number) {
  const noCode = input.replace(/```[\s\S]*?```/g, ' ');
  const t = noCode.replace(/\s+/g, ' ').trim();
  return t.length <= maxLen ? t : t.slice(0, maxLen - 1) + '…';
}

function buildSkillSearchText(pkg: ManusSkillPackage) {
  const parts = [
    pkg.displayName,
    pkg.shortDescription,
    pkg.defaultPrompt,
    pkg.specMarkdown,
    pkg.bundleContractMarkdown,
    pkg.exampleOutputMarkdown,
    pkg.referencesMarkdown
  ].filter(Boolean).map((p) => String(p));
  return compactText(parts.join('\n\n'), 2000);
}

function buildPrompt(opts: {
  pkg: ManusSkillPackage;
  ctx: SkillContext;
  req: SkillRequest;
  stage: 'candidate' | 'finalize';
  toolSeeds: any[];
}) {
  const { pkg, ctx, req, stage, toolSeeds } = opts;

  const userLine = (req.utterance ?? '').trim() || (pkg.defaultPrompt ?? '').trim() || `Use skill: ${pkg.displayName}`;
  const selection = req.selection?.selected_id ? `\nSELECTED_ID: ${req.selection.selected_id}` : (req.selection?.choice ? `\nCHOICE: ${req.selection.choice}` : '');
  const seeds = toolSeeds?.length ? `\nTOOL_SEEDS (may be partial/stub): ${JSON.stringify(toolSeeds)}` : '';
  const contract = (pkg.bundleContractMarkdown ?? '').trim();
  const example = (pkg.exampleOutputMarkdown ?? '').trim();

  // Keep it extremely explicit. The model must follow the SKILL spec, not invent a new workflow.
  return `
SYSTEM ROLE: Nightfall backstage skill executor.
STYLE: concise, editorial, non-performative.
SAFETY: do not claim facts you cannot justify; if a detail is uncertain, mark as a risk_flag or use tentative language.

SKILL_ID: ${pkg.id}
SKILL_SPEC (follow strictly):
${pkg.specMarkdown}

${contract ? `BUNDLE_CONTRACT (authoritative output contract):\n${contract}\n` : ''}
${example ? `EXAMPLE_OUTPUT (format reference only, do not copy text verbatim):\n${example}\n` : ''}

${pkg.referencesMarkdown ? `REFERENCES (canonical terms / risk flags etc.):\n${pkg.referencesMarkdown}` : ''}

RUNTIME_CONTEXT:
${JSON.stringify(ctx.context)}

STAGE: ${stage}
USER_REQUEST: ${JSON.stringify(userLine)}${selection}${seeds}
CONSTRAINTS: ${JSON.stringify(req.constraints ?? {})}

OUTPUT REQUIREMENTS:
- Output JSON only. No markdown.
- Candidate stage: return candidate_pool (2–12 items). Each item: {id,title,tag,desc}. Keep title short.
- Finalize stage: return CuratorialBundle (primary_ending + plan_b + ambient_tokens). Checklist <=5. Risk_flags <=2.
- Plan B must be more conservative than primary when possible (nearer, later, quieter, safer).

RUNTIME ADAPTER (IMPORTANT):
This runtime only accepts the JSON shapes above. If the SKILL_SPEC/BUNDLE_CONTRACT mentions
CandidateDeck/OutcomeCard/PocketTicket/FootprintEntry/MapPack:
- CandidateDeck -> candidate_pool (id,title,tag,desc).
- OutcomeCard -> primary_ending; Plan B -> plan_b.
- Do not output PocketTicket/FootprintEntry/MapPack as top-level fields.
- Fold any "last 300m" or "plan B trigger" details into checklist or reason when helpful.
`.trim();
}
