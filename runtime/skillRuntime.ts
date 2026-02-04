import type { SkillRequest, ToolName } from './contracts';
import type { ContextSignals, CuratorialBundle } from '../types';
import { AuditLog } from './audit/audit';
import { ToolBus } from './toolbus/toolBus';
import { enforceBundlePolicy } from './policy/bundlePolicy';
import { enforcePlanB } from './policy/reliabilityPlanB';
import { enforceBundleLinter } from './policy/bundleLinter';
import { RateLimiter } from './policy/rateLimit';
import { getSkill } from './skills/registry';

export interface SkillRuntimeOptions {
  audit?: AuditLog;
}

export class SkillRuntime {
  private audit: AuditLog;
  private limiter: RateLimiter;

  constructor(opts?: SkillRuntimeOptions) {
    this.audit = opts?.audit ?? new AuditLog();
    this.limiter = new RateLimiter(this.audit);
  }

  getAudit() {
    return this.audit;
  }

  async runSkill(skillId: string, request: SkillRequest, context: ContextSignals, session: Record<string, any>) {
    const skill = getSkill(skillId);
    if (!skill) throw new Error(`Skill not found: ${skillId}`);

    // PoC rate limiting (must be enforced server-side in production)
    if (!this.limiter.check(skillId, skill.manifest)) {
      throw new Error('Rate limit: try later');
    }

    const started = performance.now();
    this.audit.push({
      type: 'skill_start',
      ts: new Date().toISOString(),
      skillId,
      intent: request.intent,
      stage: request.stage,
      requestSummary: summarizeRequest(request)
    });

    const tools = new ToolBus({ allowedTools: skill.manifest.permissions.tools, audit: this.audit, session });

    try {
      const out = await skill.run(request, { context, session }, tools);

      // Domain policy: clip and normalize bundle if present
      if (out.bundle) {
        out.bundle = enforceBundlePolicy(out.bundle, this.audit);
        // Deterministic PlanB hardening using last candidate pool if available
        const candidates = Array.isArray(session?.lastCandidates) ? session.lastCandidates : undefined;
        out.bundle = enforcePlanB(out.bundle, candidates, this.audit);
        out.bundle = enforceBundleLinter(out.bundle, context, this.audit);
      }

      // UI safety: if skill returns patches, ensure it only touches allowed surfaces.
      if (out.patches?.length) {
        out.patches = filterPatchesBySurface(out.patches, skill.manifest.allowedSurfaces, this.audit);
      }

      const dt = performance.now() - started;
      this.audit.push({
        type: 'skill_end',
        ts: new Date().toISOString(),
        skillId,
        ok: true,
        duration_ms: Math.round(dt),
        outputSummary: summarizeOutput(out.bundle)
      });

      return out;
    } catch (e: any) {
      const dt = performance.now() - started;
      this.audit.push({
        type: 'skill_end',
        ts: new Date().toISOString(),
        skillId,
        ok: false,
        duration_ms: Math.round(dt),
        outputSummary: e?.message ?? 'error'
      });
      throw e;
    }
  }
}

function summarizeRequest(req: SkillRequest) {
  const u = (req.utterance ?? '').trim();
  const s = u.length > 120 ? u.slice(0, 116) + '…' : u;
  return `${req.intent}/${req.stage}: ${s}`;
}

function summarizeOutput(bundle?: CuratorialBundle) {
  if (!bundle) return 'no bundle';
  return `${bundle.primary_ending.action}:${bundle.primary_ending.title} | planB:${bundle.plan_b.action}`;
}

function filterPatchesBySurface(patches: any[], allowed: string[], audit: AuditLog) {
  const ok = new Set(allowed);

  const filtered = patches.filter((msg) => {
    const surfaceId =
      (msg.surfaceUpdate && msg.surfaceUpdate.surfaceId) ||
      (msg.beginRendering && msg.beginRendering.surfaceId) ||
      (msg.dataModelUpdate && msg.dataModelUpdate.surfaceId) ||
      (msg.deleteSurface && msg.deleteSurface.surfaceId);

    if (!surfaceId) return true; // non-surface messages (rare)
    if (ok.has(surfaceId)) return true;

    audit.push({ type: 'policy_violation', ts: new Date().toISOString(), code: 'surface_not_allowed', detail: `surfaceId=${surfaceId} blocked` });
    return false;
  });

  return filtered;
}
