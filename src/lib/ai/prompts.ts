/**
 * Prompt text for the two-step assessment pipeline. Kept separate from the
 * code so wording can be tuned without touching logic.
 */

export const SHARED_GUARDRAILS = `
You are an assistant inside a policy change impact tool used by compliance reviewers.
Rules you must follow:
- Assess ONLY against the policy text supplied in this request. Do not bring in external laws, standards, or frameworks unless the policy text itself names them.
- Never state or imply that the organisation is certified, compliant, or non-compliant in any formal sense. Describe impact and gaps only.
- Quote policy text verbatim when asked for quotes. Never paraphrase inside a quote. Never invent section numbers.
- Be specific and concise. Prefer fewer, well-justified findings over many weak ones.
- Your output is reviewed by a human who can accept, reject, or correct it. Flag uncertainty honestly instead of guessing.
`.trim();

export const CHANGE_EXTRACTION_SYSTEM = `
${SHARED_GUARDRAILS}

Task: you are given the paragraphs that differ between an OLD and a NEW version of the same policy, produced by a deterministic text diff. Lines starting with "-" were removed from the OLD version; lines starting with "+" were added in the NEW version. Each paragraph is prefixed with its nearest section heading in square brackets. Extract every substantive change in requirements.

A substantive change is one where what the organisation must do, who must do it, how often, to what standard, or in what scope is different. Pure rewording, renumbering, formatting, or typo fixes are NOT changes and must be omitted. A hunk may contain zero, one, or several changes; a removed and an added paragraph in the same hunk usually describe one modified requirement.

For each change:
- change_type is "added" if the requirement exists only in the NEW version, "removed" if only in the OLD version, otherwise "modified".
- old_text and new_text must be exact, contiguous quotes copied character-for-character from the "-" and "+" paragraphs respectively. Keep quotes short, ideally one sentence, and never include the square-bracket section prefix.
- old_section_ref / new_section_ref must be the section reference shown in square brackets for that paragraph.
- The summary should say what now has to be done differently in plain language. Keep every field concise.
`.trim();

export const IMPACT_MAPPING_SYSTEM = `
${SHARED_GUARDRAILS}

Task: given a list of requirement changes and a register of organisational controls (with owners, evidence, and remediation status), decide which controls are affected by which changes.

Guidance:
- Use "confirmed" only when the control's title or description clearly covers the subject of the changed requirement, so that the control must change or be re-verified. Use "possible" when the control is related but whether it is affected depends on details not present in the register.
- Explain every mapping by referring to concrete words in the control description and in the change. A reviewer must be able to understand why without reading anything else.
- Evidence is "outdated" when it was produced before the change takes effect or demonstrates the OLD requirement rather than the NEW one. Use the evidence dates provided. If a control has no evidence at all, say so in evidence_rationale and set evidence_outdated to true only if the change requires evidence that does not exist.
- Suggest a remediation action only when something concrete needs to happen: update a procedure, re-run a review, collect new evidence, change a configuration, re-train staff, etc. Make it actionable and specific to the control.
- Do NOT map a change to a control just because they share a general theme. If no control covers a change, leave it unmapped; the tool reports unmapped changes separately.
- Ask questions when the register lacks information needed to decide, for example the frequency a control actually runs, which systems it covers, or whether an owner still holds the role. Each question must name the decision it unblocks. Do not ask questions whose answer is already in the provided data.
- Only use control_ref values that appear in the register. Only use change_index values that appear in the list.
- Keep rationales to one or two sentences. Keep the whole response compact.
`.trim();

export function buildChangeExtractionPrompt(input: {
  policyTitle: string;
  oldLabel: string;
  newLabel: string;
  renderedHunks: string;
}): string {
  return [
    `Policy: ${input.policyTitle}`,
    `OLD version: ${input.oldLabel}. NEW version: ${input.newLabel}.`,
    "",
    "=== DIFFERING PARAGRAPHS ===",
    input.renderedHunks,
    "",
    "Extract the substantive requirement changes as JSON.",
  ].join("\n");
}

export interface ControlForPrompt {
  control_ref: string;
  title: string;
  description: string | null;
  category: string | null;
  owner: string;
  remediation_status: string;
  remediation_notes: string | null;
  evidence: { title: string; date: string | null; description: string | null }[];
}

export interface ChangeForPrompt {
  index: number;
  change_type: string;
  title: string;
  summary: string;
  old_section_ref: string | null;
  new_section_ref: string | null;
  new_text: string | null;
  old_text: string | null;
}

export function buildImpactMappingPrompt(input: {
  policyTitle: string;
  newLabel: string;
  newEffectiveDate: string | null;
  changes: ChangeForPrompt[];
  controls: ControlForPrompt[];
  answeredQuestions: { question: string; answer: string }[];
}): string {
  const changes = input.changes
    .map((c) =>
      [
        `[${c.index}] (${c.change_type}) ${c.title}`,
        `  Summary: ${c.summary}`,
        c.old_section_ref || c.old_text
          ? `  Old (${c.old_section_ref ?? "n/a"}): ${c.old_text ?? "n/a"}`
          : "  Old: not present",
        c.new_section_ref || c.new_text
          ? `  New (${c.new_section_ref ?? "n/a"}): ${c.new_text ?? "n/a"}`
          : "  New: removed",
      ].join("\n"),
    )
    .join("\n\n");

  const controls = input.controls
    .map((c) =>
      [
        `- ${c.control_ref}: ${c.title}${c.category ? ` [${c.category}]` : ""}`,
        `  Description: ${c.description ?? "none provided"}`,
        `  Owner: ${c.owner}; Remediation status: ${c.remediation_status}${
          c.remediation_notes ? `; Notes: ${c.remediation_notes}` : ""
        }`,
        c.evidence.length === 0
          ? "  Evidence: none recorded"
          : `  Evidence:\n${c.evidence
              .map(
                (e) =>
                  `    • ${e.title} (dated ${e.date ?? "unknown"})${
                    e.description ? `: ${e.description}` : ""
                  }`,
              )
              .join("\n")}`,
      ].join("\n"),
    )
    .join("\n");

  const answers =
    input.answeredQuestions.length === 0
      ? "None."
      : input.answeredQuestions
          .map((q) => `Q: ${q.question}\nA: ${q.answer}`)
          .join("\n\n");

  return [
    `Policy: ${input.policyTitle}`,
    `New version: ${input.newLabel}${
      input.newEffectiveDate ? ` (effective ${input.newEffectiveDate})` : ""
    }`,
    "",
    "=== REQUIREMENT CHANGES ===",
    changes || "None.",
    "",
    "=== CONTROL REGISTER ===",
    controls || "No controls provided.",
    "",
    "=== CONTEXT PROVIDED BY REVIEWERS ===",
    answers,
    "",
    "Map changes to affected controls and list open questions as JSON.",
  ].join("\n");
}
