import { z } from "zod";

/** Step 1: changed requirements between two policy versions. */
export const changeExtractionSchema = z.object({
  overall_summary: z
    .string()
    .describe("Two to four sentences describing what changed overall."),
  changes: z
    .array(
      z.object({
        change_type: z.enum(["added", "modified", "removed"]),
        title: z.string().describe("Short name for the changed requirement."),
        summary: z
          .string()
          .describe("Plain-language description of what the organisation must now do differently."),
        old_section_ref: z
          .string()
          .nullable()
          .describe("Section number or heading in the OLD version, or null if the requirement is new."),
        old_text: z
          .string()
          .nullable()
          .describe("Verbatim quote from the OLD version, copied exactly. Null if new."),
        new_section_ref: z
          .string()
          .nullable()
          .describe("Section number or heading in the NEW version, or null if removed."),
        new_text: z
          .string()
          .nullable()
          .describe("Verbatim quote from the NEW version, copied exactly. Null if removed."),
        rationale: z
          .string()
          .describe("Why this counts as a change in requirement rather than wording only."),
      }),
    )
    .describe("Only substantive requirement changes. Ignore formatting and pure rewording."),
});

export type ChangeExtraction = z.infer<typeof changeExtractionSchema>;

/** Step 2: mapping of changes to controls, plus open questions. */
export const impactMappingSchema = z.object({
  mappings: z.array(
    z.object({
      change_index: z
        .number()
        .int()
        .describe("Zero-based index of the change in the provided list."),
      control_ref: z.string().describe("The control reference exactly as provided."),
      impact_level: z
        .enum(["confirmed", "possible"])
        .describe(
          "confirmed: the control's stated purpose or evidence directly addresses the changed requirement. possible: the link is plausible but depends on details not in the register.",
        ),
      rationale: z
        .string()
        .describe("Why this control may be affected, referencing the control description and the change."),
      evidence_outdated: z
        .boolean()
        .describe("True if existing evidence likely no longer demonstrates the NEW requirement."),
      evidence_rationale: z
        .string()
        .nullable()
        .describe("Which evidence is affected and why, or null."),
      suggested_remediation: z
        .string()
        .nullable()
        .describe("A concrete remediation action the owner could take, or null if none is needed."),
    }),
  ),
  questions: z
    .array(
      z.object({
        question: z.string().describe("A specific question for the reviewer."),
        why_needed: z.string().describe("What decision depends on the answer."),
        related_control_refs: z.array(z.string()),
      }),
    )
    .describe("Missing context that prevents a confident mapping. Empty if none."),
});

export type ImpactMapping = z.infer<typeof impactMappingSchema>;
