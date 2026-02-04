import type { Skill } from './skill';
import type { SkillContext, SkillManifest, SkillRequest, SkillResult } from '../contracts';
import type { ToolBus } from '../toolbus/toolBus';
import type { CandidateItem } from '../../types';
import { enforceCandidatePolicy } from '../policy/candidatePolicy';
import { generateCandidatePoolWithGemini, generateCuratorialBundleWithGemini, generateCandidatePoolWithRealData, getCuratedEnding } from '../../services/gemini';
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
    // 获取用户位置
    const userLocation = req.constraints?.userLocation as { lat: number; lng: number } | undefined;
    const userInput = req.utterance ?? pkg.defaultPrompt ?? pkg.displayName;
    
    console.log('[ManusPromptSkill] runCandidate for ' + pkg.id + ', input: ' + userInput + ', location: ' + (userLocation ? 'yes' : 'no'));
    
    try {
      // 使用真实地点数据生成候选池
      const data = await generateCandidatePoolWithRealData(userInput, userLocation);
      const candidates = enforceCandidatePolicy(data.candidate_pool ?? []);
      
      console.log('[ManusPromptSkill] Generated ' + candidates.length + ' candidates with real data');
      
      return {
        candidates,
        ui: data.ui ?? undefined,
        debug: { skill: pkg.id, stage: 'candidate', realPlaces: data.places?.length || 0 }
      };
    } catch (error: any) {
      console.error('[ManusPromptSkill] Real data generation failed:', error?.message);
      
      // Fallback: 使用 LLM 生成候选池（但会标记为非真实数据）
      const prompt = buildPrompt({
        pkg,
        ctx,
        req,
        stage: 'candidate',
        toolSeeds: []
      });
      
      const data = await generateCandidatePoolWithGemini(prompt);
      const candidates = enforceCandidatePolicy(data.candidate_pool ?? []);
      
      return {
        candidates,
        ui: data.ui ?? undefined,
        debug: { skill: pkg.id, stage: 'candidate', fallback: true }
      };
    }
  }

  async function runFinalize(req: SkillRequest, ctx: SkillContext, tools: ToolBus): Promise<SkillResult> {
    // 获取用户位置
    const userLocation = req.constraints?.userLocation as { lat: number; lng: number } | undefined;
    const userInput = req.utterance ?? pkg.defaultPrompt ?? pkg.displayName;
    const selectedId = req.selection?.selected_id;
    const choice = req.selection?.choice;
    
    // 构建完整的用户请求（包含选择的偏好）
    const fullInput = choice ? userInput + ' ' + choice : userInput;
    
    console.log('[ManusPromptSkill] runFinalize for ' + pkg.id + ', input: ' + fullInput + ', selectedId: ' + selectedId);
    
    try {
      // 使用真实地点数据生成最终票据
      const bundle = await getCuratedEnding(fullInput, ctx.context, userLocation);
      
      console.log('[ManusPromptSkill] Generated bundle with real data: ' + bundle.primary_ending?.title);
      
      return {
        bundle,
        ui: (bundle as any).ui_hints ?? undefined,
        debug: { skill: pkg.id, stage: 'finalize', realData: true }
      };
    } catch (error: any) {
      console.error('[ManusPromptSkill] Real data generation failed:', error?.message);
      
      // Fallback: 使用 LLM 生成票据
      const prompt = buildPrompt({
        pkg,
        ctx,
        req,
        stage: 'finalize',
        toolSeeds: []
      });
      
      const bundle = await generateCuratorialBundleWithGemini(prompt);
      
      return {
        bundle,
        ui: (bundle as any).ui_hints ?? undefined,
        debug: { skill: pkg.id, stage: 'finalize', fallback: true }
      };
    }
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

  const userLine = (req.utterance ?? '').trim() || (pkg.defaultPrompt ?? '').trim() || 'Use skill: ' + pkg.displayName;
  const selection = req.selection?.selected_id ? '\nSELECTED_ID: ' + req.selection.selected_id : (req.selection?.choice ? '\nCHOICE: ' + req.selection.choice : '');
  const seeds = toolSeeds?.length ? '\nTOOL_SEEDS (may be partial/stub): ' + JSON.stringify(toolSeeds) : '';
  const contract = (pkg.bundleContractMarkdown ?? '').trim();
  const example = (pkg.exampleOutputMarkdown ?? '').trim();

  // Keep it extremely explicit. The model must follow the SKILL spec, not invent a new workflow.
  return 'SYSTEM ROLE: Nightfall backstage skill executor.\n' +
    'STYLE: concise, editorial, non-performative.\n' +
    'SAFETY: do not claim facts you cannot justify; if a detail is uncertain, mark as a risk_flag or use tentative language.\n\n' +
    'SKILL_ID: ' + pkg.id + '\n' +
    'SKILL_SPEC (follow strictly):\n' + pkg.specMarkdown + '\n\n' +
    (contract ? 'BUNDLE_CONTRACT (authoritative output contract):\n' + contract + '\n\n' : '') +
    (example ? 'EXAMPLE_OUTPUT (format reference only, do not copy text verbatim):\n' + example + '\n\n' : '') +
    (pkg.referencesMarkdown ? 'REFERENCES (canonical terms / risk flags etc.):\n' + pkg.referencesMarkdown + '\n\n' : '') +
    'RUNTIME_CONTEXT:\n' + JSON.stringify(ctx.context) + '\n\n' +
    'STAGE: ' + stage + '\n' +
    'USER_REQUEST: ' + JSON.stringify(userLine) + selection + seeds + '\n' +
    'CONSTRAINTS: ' + JSON.stringify(req.constraints ?? {}) + '\n\n' +
    'OUTPUT REQUIREMENTS:\n' +
    '- Output JSON only. No markdown.\n' +
    '- Candidate stage: return candidate_pool (2-12 items). Each item: {id,title,tag,desc}. Keep title short.\n' +
    '- Finalize stage: return CuratorialBundle (primary_ending + plan_b + ambient_tokens). Checklist <=5. Risk_flags <=2.\n' +
    '- Plan B must be more conservative than primary when possible (nearer, later, quieter, safer).\n\n' +
    'RUNTIME ADAPTER (IMPORTANT):\n' +
    'This runtime only accepts the JSON shapes above. If the SKILL_SPEC/BUNDLE_CONTRACT mentions\n' +
    'CandidateDeck/OutcomeCard/PocketTicket/FootprintEntry/MapPack:\n' +
    '- CandidateDeck -> candidate_pool (id,title,tag,desc).\n' +
    '- OutcomeCard -> primary_ending; Plan B -> plan_b.\n' +
    '- Do not output PocketTicket/FootprintEntry/MapPack as top-level fields.\n' +
    '- Fold any "last 300m" or "plan B trigger" details into checklist or reason when helpful.';
}
