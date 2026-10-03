import "server-only";
import { diffParagraphs, renderHunks, type DiffHunk } from "@/lib/ai/diff";
import { estimateTokens, generateStructured } from "@/lib/ai/groq";
import {
  buildChangeExtractionPrompt,
  buildImpactMappingPrompt,
  CHANGE_EXTRACTION_SYSTEM,
  IMPACT_MAPPING_SYSTEM,
  type ChangeForPrompt,
  type ControlForPrompt,
} from "@/lib/ai/prompts";
import {
  changeExtractionSchema,
  impactMappingSchema,
  type ChangeExtraction,
} from "@/lib/ai/schemas";
import type { ChangeType, ImpactLevel } from "@/lib/supabase/database.types";

/**
 * Free-tier budgets are tight (8K tokens per minute on Groq), so prompts are
 * split into batches that stay under PROMPT_TOKEN_BUDGET including the system
 * instruction, and calls are paced so a rolling minute never exceeds
 * MINUTE_TOKEN_BUDGET.
 */
const PROMPT_TOKEN_BUDGET = 3200;
const OUTPUT_TOKEN_CAP = 2500;
const MINUTE_TOKEN_BUDGET = 7000;

export interface PipelineControl extends ControlForPrompt {
  id: string;
}

export interface PipelineInput {
  policyTitle: string;
  oldVersion: { label: string; content: string };
  newVersion: { label: string; content: string; effectiveDate: string | null };
  controls: PipelineControl[];
  answeredQuestions: { question: string; answer: string }[];
}

export interface ExtractedChange {
  position: number;
  change_type: ChangeType;
  title: string;
  summary: string;
  old_section_ref: string | null;
  old_text: string | null;
  new_section_ref: string | null;
  new_text: string | null;
  rationale: string;
  citation_verified: boolean;
}

export interface ExtractedMapping {
  change_position: number;
  control_id: string;
  control_ref: string;
  ai_impact_level: ImpactLevel;
  ai_rationale: string;
  evidence_outdated: boolean;
  evidence_rationale: string | null;
  suggested_remediation: string | null;
}

export interface ExtractedQuestion {
  question: string;
  why_needed: string;
  related_control_ids: string[];
}

export interface PipelineResult {
  model: string;
  summary: string;
  hunkCount: number;
  changes: ExtractedChange[];
  mappings: ExtractedMapping[];
  questions: ExtractedQuestion[];
  droppedMappings: number;
  calls: number;
  usage: { promptTokens: number; outputTokens: number; totalTokens: number };
}

/** Whitespace-insensitive containment check for citation verification. */
function normalize(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
    .toLowerCase();
}

function quoteAppearsIn(quote: string | null, source: string): boolean {
  if (!quote) return true;
  return normalize(source).includes(normalize(quote));
}

/** Keeps a rolling-minute token budget so free-tier limits are not tripped. */
class TokenPacer {
  private events: { at: number; tokens: number }[] = [];

  async reserve(expected: number): Promise<void> {
    const now = Date.now();
    this.events = this.events.filter((e) => now - e.at < 60_000);
    const used = this.events.reduce((sum, e) => sum + e.tokens, 0);
    if (used + expected > MINUTE_TOKEN_BUDGET && this.events.length > 0) {
      const oldest = this.events[0].at;
      const wait = Math.max(0, 60_000 - (now - oldest)) + 250;
      await new Promise((resolve) => setTimeout(resolve, wait));
      this.events = [];
    }
  }

  record(tokens: number) {
    this.events.push({ at: Date.now(), tokens });
  }
}

/** Groups items into batches whose rendered size stays under the budget. */
function batchByTokens<T>(
  items: T[],
  render: (batch: T[]) => string,
  fixedTokens: number,
): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  for (const item of items) {
    const candidate = [...current, item];
    if (current.length > 0 && fixedTokens + estimateTokens(render(candidate)) > PROMPT_TOKEN_BUDGET) {
      batches.push(current);
      current = [item];
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function verifyChanges(
  extraction: ChangeExtraction,
  oldText: string,
  newText: string,
  startPosition: number,
): ExtractedChange[] {
  return extraction.changes.map((change, offset) => {
    const oldOk = change.change_type === "added" || quoteAppearsIn(change.old_text, oldText);
    const newOk = change.change_type === "removed" || quoteAppearsIn(change.new_text, newText);
    return {
      position: startPosition + offset,
      change_type: change.change_type,
      title: change.title,
      summary: change.summary,
      old_section_ref: change.old_section_ref,
      old_text: change.old_text,
      new_section_ref: change.new_section_ref,
      new_text: change.new_text,
      rationale: change.rationale,
      citation_verified: oldOk && newOk,
    };
  });
}

/**
 * Runs the assessment:
 *  0. deterministic paragraph diff of the two versions;
 *  1. the model turns differing paragraphs into requirement changes with
 *     citations, which are then verified against the stored text;
 *  2. the model maps changes to controls in small batches; unknown refs are
 *     dropped and counted.
 */
export async function runAssessmentPipeline(input: PipelineInput): Promise<PipelineResult> {
  const usage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };
  let calls = 0;
  const pacer = new TokenPacer();
  let model = "";

  const track = (u: typeof usage, m: string) => {
    usage.promptTokens += u.promptTokens;
    usage.outputTokens += u.outputTokens;
    usage.totalTokens += u.totalTokens;
    pacer.record(u.totalTokens);
    calls += 1;
    model = m;
  };

  // Step 0: deterministic diff
  const hunks: DiffHunk[] = diffParagraphs(input.oldVersion.content, input.newVersion.content);

  const changes: ExtractedChange[] = [];
  const summaries: string[] = [];

  if (hunks.length > 0) {
    const systemTokens = estimateTokens(CHANGE_EXTRACTION_SYSTEM) + 80;
    const hunkBatches = batchByTokens(hunks, renderHunks, systemTokens);

    for (const batch of hunkBatches) {
      const prompt = buildChangeExtractionPrompt({
        policyTitle: input.policyTitle,
        oldLabel: input.oldVersion.label,
        newLabel: input.newVersion.label,
        renderedHunks: renderHunks(batch),
      });
      await pacer.reserve(systemTokens + estimateTokens(prompt) + OUTPUT_TOKEN_CAP);
      const result = await generateStructured({
        schema: changeExtractionSchema,
        schemaName: "requirement_changes",
        systemInstruction: CHANGE_EXTRACTION_SYSTEM,
        prompt,
        temperature: 0.1,
        maxOutputTokens: OUTPUT_TOKEN_CAP,
        reasoningEffort: "low",
      });
      track(result.usage, result.model);
      summaries.push(result.data.overall_summary);
      changes.push(
        ...verifyChanges(
          result.data,
          input.oldVersion.content,
          input.newVersion.content,
          changes.length,
        ),
      );
    }
  }

  const mappings: ExtractedMapping[] = [];
  const questions: ExtractedQuestion[] = [];
  let droppedMappings = 0;

  if (changes.length > 0 && input.controls.length > 0) {
    const changesForPrompt: ChangeForPrompt[] = changes.map((c) => ({
      index: c.position,
      change_type: c.change_type,
      title: c.title,
      summary: c.summary,
      old_section_ref: c.old_section_ref,
      new_section_ref: c.new_section_ref,
      old_text: c.old_text,
      new_text: c.new_text,
    }));

    const controlByRef = new Map(input.controls.map((c) => [c.control_ref.toLowerCase(), c]));
    const seen = new Set<string>();

    const renderBatch = (batch: PipelineControl[]) =>
      buildImpactMappingPrompt({
        policyTitle: input.policyTitle,
        newLabel: input.newVersion.label,
        newEffectiveDate: input.newVersion.effectiveDate,
        changes: changesForPrompt,
        controls: batch,
        answeredQuestions: input.answeredQuestions,
      });
    const systemTokens = estimateTokens(IMPACT_MAPPING_SYSTEM) + 80;
    const controlBatches = batchByTokens(input.controls, renderBatch, systemTokens);

    for (const batch of controlBatches) {
      const prompt = renderBatch(batch);
      await pacer.reserve(systemTokens + estimateTokens(prompt) + OUTPUT_TOKEN_CAP);
      const result = await generateStructured({
        schema: impactMappingSchema,
        schemaName: "impact_mappings",
        systemInstruction: IMPACT_MAPPING_SYSTEM,
        prompt,
        temperature: 0.2,
        maxOutputTokens: OUTPUT_TOKEN_CAP,
        reasoningEffort: "medium",
      });
      track(result.usage, result.model);

      for (const m of result.data.mappings) {
        const control = controlByRef.get(m.control_ref.toLowerCase());
        const change = changes[m.change_index];
        if (!control || !change) {
          droppedMappings += 1;
          continue;
        }
        const key = `${change.position}:${control.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        mappings.push({
          change_position: change.position,
          control_id: control.id,
          control_ref: control.control_ref,
          ai_impact_level: m.impact_level,
          ai_rationale: m.rationale,
          evidence_outdated: m.evidence_outdated,
          evidence_rationale: m.evidence_rationale,
          suggested_remediation: m.suggested_remediation,
        });
      }

      for (const q of result.data.questions) {
        const related = q.related_control_refs
          .map((ref) => controlByRef.get(ref.toLowerCase())?.id)
          .filter((id): id is string => Boolean(id));
        questions.push({
          question: q.question,
          why_needed: q.why_needed,
          related_control_ids: related,
        });
      }
    }
  }

  const summary =
    summaries.length === 0
      ? "No differing paragraphs were found between the two versions."
      : summaries.length === 1
        ? summaries[0]
        : summaries.map((s, i) => `Part ${i + 1}: ${s}`).join("\n\n");

  return {
    model,
    summary,
    hunkCount: hunks.length,
    changes,
    mappings,
    questions,
    droppedMappings,
    calls,
    usage,
  };
}
