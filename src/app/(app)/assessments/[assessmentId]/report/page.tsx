import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/report/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  computeAssessmentMetrics,
  effectiveLevel,
  isEffective,
  snapshotControlIds,
} from "@/lib/assessments/metrics";
import { getAssessment, type MappingWithControl } from "@/lib/assessments/queries";
import {
  computeStaleness,
  describeStaleReason,
  loadStalenessContext,
} from "@/lib/assessments/staleness";
import { actionLabel } from "@/lib/audit-log/labels";
import { listEntityHistory } from "@/lib/audit-log/queries";
import { REMEDIATION_STATUS_LABELS } from "@/lib/controls/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import { ACTION_STATUS_LABELS } from "@/lib/remediation/constants";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

type Props = PageProps<"/assessments/[assessmentId]/report">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { assessmentId } = await props.params;
  const assessment = await getAssessment(assessmentId);
  return { title: assessment ? `Impact report · ${assessment.policy.title}` : "Impact report" };
}

const DECISION_ACTIONS = new Set([
  "review_accept",
  "review_reject",
  "review_correct",
  "review_reset",
  "added_by_reviewer",
  "carried_forward",
  "completed",
  "reopened",
  "accepted",
  "revoked",
  "status_done",
  "status_cancelled",
  "analysis_completed",
  "reevaluation_completed",
  "superseded",
]);

export default async function ReportPage(props: Props) {
  const { assessmentId } = await props.params;
  const [assessment, context, history, viewer, snapshotControls] = await Promise.all([
    getAssessment(assessmentId),
    loadStalenessContext(),
    listEntityHistory(assessmentId, "assessment_id", 500),
    getCurrentUser(),
    loadSnapshotControls(assessmentId),
  ]);
  if (!assessment) notFound();

  const metrics = computeAssessmentMetrics({
    snapshotControlIds: snapshotControlIds(assessment.control_snapshot),
    changeIds: assessment.changes.map((c) => c.id),
    mappings: assessment.mappings,
    actions: assessment.actions,
    riskAcceptances: assessment.risk_acceptances,
  });
  const staleReasons = assessment.superseded_by_id ? [] : computeStaleness(assessment, context);
  const names = new Map([...assessment.profiles.values()].map((p) => [p.id, p.full_name ?? p.email]));
  const nameOf = (id: string | null) => (id ? (names.get(id) ?? "unknown") : "unknown");

  const effective = assessment.mappings.filter((m) => isEffective(m.review_status));
  const rejected = assessment.mappings.filter((m) => m.review_status === "rejected");
  const pending = assessment.mappings.filter((m) => m.review_status === "pending");
  const changeById = new Map(assessment.changes.map((c) => [c.id, c]));
  const mappedChangeIds = new Set(effective.map((m) => m.requirement_change_id));
  const unmappedChanges = assessment.changes.filter((c) => !mappedChangeIds.has(c.id));

  const byControl = new Map<string, { control: MappingWithControl["control"]; items: MappingWithControl[] }>();
  for (const m of effective) {
    const g = byControl.get(m.control_id) ?? { control: m.control, items: [] };
    g.items.push(m);
    byControl.set(m.control_id, g);
  }
  const controlGroups = [...byControl.values()].sort((a, b) =>
    a.control.control_ref.localeCompare(b.control.control_ref, undefined, { numeric: true }),
  );
  const unmappedControls = snapshotControls.filter((c) => !byControl.has(c.id));

  const actionsByMapping = new Map<string, typeof assessment.actions>();
  for (const a of assessment.actions) {
    const list = actionsByMapping.get(a.impact_mapping_id) ?? [];
    list.push(a);
    actionsByMapping.set(a.impact_mapping_id, list);
  }
  const activeAcceptance = new Map(
    assessment.risk_acceptances.filter((r) => !r.revoked_at).map((r) => [r.impact_mapping_id, r]),
  );

  const reviewers = [...new Set(effective.concat(rejected).map((m) => m.reviewer_id).filter(Boolean))] as string[];
  const decisionLog = history.filter((h) => DECISION_ACTIONS.has(h.action));
  const isDraft = assessment.status !== "completed";
  const counts = {
    mapped: metrics.mapped,
    unmapped: metrics.unmapped,
    compliant: metrics.compliant,
    unresolved: metrics.unresolved,
    pending: metrics.pending,
  };

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-8 text-sm print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/assessments/${assessment.id}`}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Back to assessment
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href={`/assessments/${assessment.id}`} />}>
            Close
          </Button>
          <PrintButton assessmentId={assessment.id} status={assessment.status} counts={counts} />
        </div>
      </div>

      {/* Title block */}
      <header className="flex flex-col gap-2 border-b pb-6">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Policy change impact report</p>
        <h1 className="text-3xl font-semibold tracking-tight">{assessment.policy.title}</h1>
        <p>
          Version #{assessment.from_version.version_number} ({assessment.from_version.label}) → Version #
          {assessment.to_version.version_number} ({assessment.to_version.label})
          {assessment.to_version.effective_date ? `, effective ${formatDate(assessment.to_version.effective_date)}` : ""}
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <Field label="Assessment" value={`v${assessment.assessment_version}`} />
          <Field label="Status" value={isDraft ? `${assessment.status.replace("_", " ")} (draft report)` : "Reviewed and completed"} />
          <Field label="Analyzed" value={formatDateTime(assessment.analyzed_at)} />
          <Field label="Completed" value={formatDateTime(assessment.completed_at)} />
          <Field label="Generated" value={formatDateTime(new Date())} />
          <Field label="Generated by" value={viewer?.email ?? "unknown"} />
          <Field label="Model" value={assessment.ai_model ?? "—"} />
          <Field label="Controls in scope" value={String(snapshotControls.length)} />
        </dl>
        {isDraft ? (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
            Draft: the review is not complete. {pending.length} mapping{pending.length === 1 ? "" : "s"} still await a
            decision and are excluded from the counts below.
          </p>
        ) : null}
        {staleReasons.length > 0 ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs">
            <p className="font-medium">This assessment is stale. Re-evaluate before relying on it.</p>
            <ul className="list-disc pl-4">
              {staleReasons.map((r) => (
                <li key={describeStaleReason(r)}>{describeStaleReason(r)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {assessment.superseded_by_id ? (
          <p className="rounded-md border p-2 text-xs">
            Superseded: a later assessment version replaced this one. This report is historical.
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Scope and limitations: this report assesses the control register only against the two supplied versions
          of the policy named above. It does not consider external laws, standards, or frameworks, and it is not a
          certification or formal statement of compliance. Impact mappings were proposed by an AI model and every
          mapping included below was accepted or corrected by a named reviewer.
        </p>
      </header>

      {/* Summary */}
      <section className="print-avoid-break flex flex-col gap-3">
        <h2 className="text-lg font-semibold">1. Summary</h2>
        {assessment.ai_summary ? <p className="whitespace-pre-wrap">{assessment.ai_summary}</p> : null}
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Mapped controls" value={metrics.mapped} />
          <Stat label="Unmapped controls" value={metrics.unmapped} />
          <Stat label="Compliant" value={metrics.compliant} />
          <Stat label="Unresolved" value={metrics.unresolved} />
        </dl>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
          <Field label="Requirement changes" value={String(assessment.changes.length)} />
          <Field label="Confirmed impacts" value={String(metrics.confirmed)} />
          <Field label="Possible impacts" value={String(metrics.possible)} />
          <Field label="Rejected proposals" value={String(metrics.rejected)} />
          <Field label="Remediation actions" value={String(assessment.actions.filter((a) => a.status !== "cancelled").length)} />
          <Field label="Actions done" value={String(assessment.actions.filter((a) => a.status === "done").length)} />
          <Field label="Active risk acceptances" value={String(activeAcceptance.size)} />
          <Field label="Open questions" value={String(assessment.questions.filter((q) => !q.answer).length)} />
        </dl>
        <p className="text-xs text-muted-foreground">
          Definitions: a control is mapped when a reviewer accepted at least one impact on it. It is compliant when
          every accepted impact is resolved by a completed remediation action, an active risk acceptance, or a reviewer
          decision that no action is required. Counts are computed from reviewer decisions only.
        </p>
      </section>

      {/* Changes */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">2. Changed requirements</h2>
        {assessment.changes.length === 0 ? <p>No substantive requirement changes were identified.</p> : null}
        {assessment.changes.map((c) => (
          <div key={c.id} className="print-avoid-break flex flex-col gap-2 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">C{c.position + 1}</span>
              <Badge variant="outline" className="capitalize">{c.change_type}</Badge>
              {!c.citation_verified ? <Badge variant="outline">Citation not found verbatim</Badge> : null}
              {!mappedChangeIds.has(c.id) ? <Badge variant="outline">No accepted impact</Badge> : null}
              <span className="font-medium">{c.title}</span>
            </div>
            <p>{c.summary}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Quote heading={`Old${c.old_section_ref ? ` · § ${c.old_section_ref}` : ""}`} text={c.old_text} empty="Not present in the previous version." />
              <Quote heading={`New${c.new_section_ref ? ` · § ${c.new_section_ref}` : ""}`} text={c.new_text} empty="Removed in the new version." />
            </div>
          </div>
        ))}
      </section>

      {/* Affected controls */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">3. Affected controls and remediation</h2>
        {controlGroups.length === 0 ? <p>No controls have an accepted impact.</p> : null}
        {controlGroups.map(({ control, items }) => {
          const state = metrics.controlStates.get(control.id);
          const owner = (control.owner_id ? names.get(control.owner_id) : null) ?? control.owner_name ?? "Unassigned";
          return (
            <div key={control.id} className="print-avoid-break flex flex-col gap-3 rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{control.control_ref}</span>
                <span className="font-medium">{control.title}</span>
                <Badge variant="outline">{state === "compliant" ? "Compliant" : "Unresolved"}</Badge>
                <span className="text-xs text-muted-foreground">
                  Owner: {owner} · Register status: {REMEDIATION_STATUS_LABELS[control.remediation_status]}
                </span>
              </div>
              {items.map((m) => {
                const change = changeById.get(m.requirement_change_id);
                const actions = (actionsByMapping.get(m.id) ?? []).filter((a) => a.status !== "cancelled");
                const acceptance = activeAcceptance.get(m.id);
                const resolved = metrics.mappingResolved.get(m.id) === true;
                return (
                  <div key={m.id} className="flex flex-col gap-1 border-l-2 pl-3">
                    <p>
                      <span className="font-medium">
                        {effectiveLevel(m) === "confirmed" ? "Confirmed impact" : "Possible impact"}
                      </span>
                      {change ? ` from C${change.position + 1} · ${change.title}` : ""}
                      {change?.new_section_ref ? ` (§ ${change.new_section_ref})` : ""}
                      {" · "}
                      <span className="text-muted-foreground">{resolved ? "Resolved" : "Open"}</span>
                    </p>
                    <p className="text-muted-foreground">Why: {m.ai_rationale}</p>
                    {m.evidence_outdated ? (
                      <p className="text-muted-foreground">
                        Evidence flagged as potentially outdated{m.evidence_rationale ? `: ${m.evidence_rationale}` : "."}
                      </p>
                    ) : null}
                    <p className="text-xs">
                      Reviewer decision: {m.review_status === "corrected" ? `corrected to ${m.final_impact_level} (agent proposed ${m.ai_impact_level})` : "accepted"}
                      {m.source === "reviewer" ? ", added by reviewer" : ""} by {nameOf(m.reviewer_id)} on{" "}
                      {formatDateTime(m.reviewed_at)}
                      {m.no_action_required ? ". Marked no action required." : "."}
                      {m.reviewer_note ? ` Note: ${m.reviewer_note}` : ""}
                    </p>
                    {actions.length > 0 ? (
                      <ul className="list-disc pl-5 text-xs">
                        {actions.map((a) => (
                          <li key={a.id}>
                            <span className="font-medium">{a.title}</span> · {ACTION_STATUS_LABELS[a.status]} · Owner{" "}
                            {(a.owner_id ? names.get(a.owner_id) : null) ?? a.owner_name ?? "Unassigned"}
                            {a.due_date ? ` · Due ${formatDate(a.due_date)}` : ""}
                            {a.completed_at ? ` · Completed ${formatDate(a.completed_at.slice(0, 10))}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {acceptance ? (
                      <p className="text-xs">
                        Risk accepted by {nameOf(acceptance.accepted_by)} on {formatDate(acceptance.created_at.slice(0, 10))},
                        review by {formatDate(acceptance.review_date)}. Reason: {acceptance.reason}
                      </p>
                    ) : null}
                    {!resolved && actions.length === 0 && !acceptance ? (
                      <p className="text-xs text-muted-foreground">
                        No remediation action or risk acceptance recorded yet.
                        {m.suggested_remediation ? ` Agent suggestion: ${m.suggested_remediation}` : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      {/* Gaps */}
      <section className="print-avoid-break flex flex-col gap-3">
        <h2 className="text-lg font-semibold">4. Items without an accepted impact</h2>
        <h3 className="font-medium">Changes with no accepted control mapping ({unmappedChanges.length})</h3>
        {unmappedChanges.length === 0 ? (
          <p className="text-muted-foreground">Every change is covered by at least one accepted mapping.</p>
        ) : (
          <ul className="list-disc pl-5">
            {unmappedChanges.map((c) => (
              <li key={c.id}>
                C{c.position + 1} · {c.title}
                {c.new_section_ref ? ` (§ ${c.new_section_ref})` : ""}
              </li>
            ))}
          </ul>
        )}
        <h3 className="font-medium">Controls in scope with no accepted impact ({unmappedControls.length})</h3>
        {unmappedControls.length === 0 ? (
          <p className="text-muted-foreground">Every in-scope control has an accepted impact.</p>
        ) : (
          <p className="text-muted-foreground">
            {unmappedControls.map((c) => `${c.control_ref} ${c.title}`).join("; ")}
          </p>
        )}
        {rejected.length > 0 ? (
          <>
            <h3 className="font-medium">Rejected proposals ({rejected.length})</h3>
            <ul className="list-disc pl-5 text-xs">
              {rejected.map((m) => {
                const change = changeById.get(m.requirement_change_id);
                return (
                  <li key={m.id}>
                    {m.control.control_ref} ← {change ? `C${change.position + 1}` : "?"} ({m.ai_impact_level}): rejected by{" "}
                    {nameOf(m.reviewer_id)}
                    {m.reviewer_note ? ` — ${m.reviewer_note}` : ""}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </section>

      {/* Questions */}
      <section className="print-avoid-break flex flex-col gap-3">
        <h2 className="text-lg font-semibold">5. Context requested by the agent</h2>
        {assessment.questions.length === 0 ? (
          <p className="text-muted-foreground">No additional context was requested.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {assessment.questions.map((q) => (
              <li key={q.id} className="rounded-md border p-2">
                <p className="font-medium">{q.question}</p>
                {q.why_needed ? <p className="text-xs text-muted-foreground">Needed to decide: {q.why_needed}</p> : null}
                <p className="text-xs">
                  {q.answer ? `Answer (${nameOf(q.answered_by)}, ${formatDateTime(q.answered_at)}): ${q.answer}` : "Unanswered."}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Decision log */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">6. Decision log</h2>
        {decisionLog.length === 0 ? (
          <p className="text-muted-foreground">No decisions recorded yet.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 pr-3 font-medium">When</th>
                <th className="py-1 pr-3 font-medium">Who</th>
                <th className="py-1 pr-3 font-medium">Decision</th>
                <th className="py-1 font-medium">Record</th>
              </tr>
            </thead>
            <tbody>
              {decisionLog.map((h) => (
                <tr key={h.id} className="border-b align-top">
                  <td className="py-1 pr-3 whitespace-nowrap">{formatDateTime(h.created_at)}</td>
                  <td className="py-1 pr-3">{h.actor_email ?? "system"}</td>
                  <td className="py-1 pr-3">{actionLabel(h.action)}</td>
                  <td className="py-1 font-mono">{h.entity_type} {h.entity_id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Sign-off */}
      <section className="print-avoid-break flex flex-col gap-3 border-t pt-6">
        <h2 className="text-lg font-semibold">7. Reviewers</h2>
        {reviewers.length === 0 ? (
          <p className="text-muted-foreground">No reviewer decisions have been recorded.</p>
        ) : (
          <ul className="list-disc pl-5">
            {reviewers.map((id) => (
              <li key={id}>{nameOf(id)}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Reviewer decisions, remediation actions, and risk acceptances are recorded in an append-only audit log with
          actor and timestamp. This document was generated from that record on {formatDateTime(new Date())}.
        </p>
      </section>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Quote({ heading, text, empty }: { heading: string; text: string | null; empty: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-2">
      <p className="text-xs font-medium text-muted-foreground">{heading}</p>
      {text ? <blockquote className="whitespace-pre-wrap">“{text}”</blockquote> : <p className="text-muted-foreground italic">{empty}</p>}
    </div>
  );
}

async function loadSnapshotControls(assessmentId: string) {
  const supabase = await createClient();
  const { data: assessment } = await supabase
    .from("assessments")
    .select("control_snapshot")
    .eq("id", assessmentId)
    .maybeSingle();
  const ids = assessment ? snapshotControlIds(assessment.control_snapshot) : [];
  if (ids.length === 0) return [] as { id: string; control_ref: string; title: string }[];
  const { data } = await supabase
    .from("controls")
    .select("id, control_ref, title")
    .in("id", ids)
    .order("control_ref");
  return data ?? [];
}
