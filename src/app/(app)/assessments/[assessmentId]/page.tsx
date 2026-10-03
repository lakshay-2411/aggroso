import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddMappingForm } from "@/components/assessments/add-mapping-form";
import { AssessmentStatusBadge, StaleBadge } from "@/components/assessments/badges";
import { ChangesList } from "@/components/assessments/changes-list";
import { MappingsList } from "@/components/assessments/mappings-list";
import { MetricsGrid, SecondaryMetrics } from "@/components/assessments/metrics-grid";
import { QuestionsPanel } from "@/components/assessments/questions-panel";
import { ReviewControls } from "@/components/assessments/review-controls";
import { ResolutionPanel } from "@/components/remediation/resolution-panel";
import { RunAnalysisButton } from "@/components/assessments/run-analysis-button";
import { StaleAlert } from "@/components/assessments/stale-alert";
import { AuditTable } from "@/components/audit/audit-table";
import {
  CompleteAssessmentButton,
  ReopenAssessmentButton,
} from "@/components/assessments/status-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  computeAssessmentMetrics,
  isEffective,
  snapshotControlIds,
} from "@/lib/assessments/metrics";
import { getAssessment, listActiveControlOptions } from "@/lib/assessments/queries";
import { listEntityHistory } from "@/lib/audit-log/queries";
import {
  computeStaleness,
  describeStaleReason,
  loadStalenessContext,
} from "@/lib/assessments/staleness";
import { formatDateTime } from "@/lib/format";

type Props = PageProps<"/assessments/[assessmentId]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { assessmentId } = await props.params;
  const assessment = await getAssessment(assessmentId);
  return { title: assessment ? `Assessment · ${assessment.policy.title}` : "Assessment" };
}

export default async function AssessmentPage(props: Props) {
  const { assessmentId } = await props.params;
  const [assessment, controlOptions, stalenessContext, history] = await Promise.all([
    getAssessment(assessmentId),
    listActiveControlOptions(),
    loadStalenessContext(),
    listEntityHistory(assessmentId, "assessment_id"),
  ]);
  if (!assessment) notFound();

  // Staleness is computed live from the current policy versions and control
  // revisions, so the page never shows an outdated flag.
  const staleReasons = assessment.superseded_by_id
    ? []
    : computeStaleness(assessment, stalenessContext);
  const isStale = staleReasons.length > 0;
  const latestVersion = stalenessContext.latestVersions.get(assessment.policy_id) ?? null;
  const fromOptions = [
    { id: assessment.from_version.id, label: `#${assessment.from_version.version_number} ${assessment.from_version.label} (original baseline)` },
    ...(assessment.to_version.id !== latestVersion?.id
      ? [{ id: assessment.to_version.id, label: `#${assessment.to_version.version_number} ${assessment.to_version.label} (last assessed)` }]
      : []),
  ];

  const metrics = computeAssessmentMetrics({
    snapshotControlIds: snapshotControlIds(assessment.control_snapshot),
    changeIds: assessment.changes.map((c) => c.id),
    mappings: assessment.mappings,
    actions: assessment.actions,
    riskAcceptances: assessment.risk_acceptances,
  });

  const ownerChoices = [...assessment.profiles.values()].map((p) => ({
    id: p.id,
    label: p.full_name ? `${p.full_name} (${p.email})` : p.email,
  }));
  const actionsByMapping = new Map<string, typeof assessment.actions>();
  for (const a of assessment.actions) {
    const list = actionsByMapping.get(a.impact_mapping_id) ?? [];
    list.push(a);
    actionsByMapping.set(a.impact_mapping_id, list);
  }
  const acceptancesByMapping = new Map<string, typeof assessment.risk_acceptances>();
  for (const r of assessment.risk_acceptances) {
    const list = acceptancesByMapping.get(r.impact_mapping_id) ?? [];
    list.push(r);
    acceptancesByMapping.set(r.impact_mapping_id, list);
  }

  const mappedChangeIds = new Set(
    assessment.mappings
      .filter((m) => m.review_status !== "rejected")
      .map((m) => m.requirement_change_id),
  );
  const ownerNames = new Map(
    [...assessment.profiles.values()].map((p) => [p.id, p.full_name ?? p.email]),
  );
  const controlLabels = new Map(
    assessment.mappings.map((m) => [m.control_id, `${m.control.control_ref} ${m.control.title}`]),
  );
  const changeOptions = assessment.changes.map((c) => ({
    id: c.id,
    label: `C${c.position + 1} · ${c.title}`,
  }));

  const isSuperseded = Boolean(assessment.superseded_by_id);
  const isInReview = assessment.status === "in_review" && !isSuperseded;
  // Remediation continues after the review is completed, unless superseded.
  const canRemediate = !isSuperseded && (assessment.status === "in_review" || assessment.status === "completed");
  const hasResults = assessment.status !== "draft" && assessment.status !== "analyzing";
  const canRun =
    assessment.status === "draft" ||
    assessment.status === "failed" ||
    (isInReview && assessment.mappings.every((m) => m.review_status === "pending"));

  const versionLink = (id: string) => `/policies/${assessment.policy.id}/versions/${id}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href="/assessments"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Assessments
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{assessment.policy.title}</h1>
            <AssessmentStatusBadge status={assessment.status} />
            {isStale ? <StaleBadge /> : null}
            {assessment.superseded_by_id ? <Badge variant="outline">Superseded</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Assessment v{assessment.assessment_version} ·{" "}
            <Link href={versionLink(assessment.from_version.id)} className="underline-offset-4 hover:underline">
              #{assessment.from_version.version_number} {assessment.from_version.label}
            </Link>{" "}
            →{" "}
            <Link href={versionLink(assessment.to_version.id)} className="underline-offset-4 hover:underline">
              #{assessment.to_version.version_number} {assessment.to_version.label}
            </Link>
            {assessment.analyzed_at ? ` · Analyzed ${formatDateTime(assessment.analyzed_at)}` : null}
            {assessment.completed_at ? ` · Completed ${formatDateTime(assessment.completed_at)}` : null}
            {assessment.supersedes_id ? (
              <>
                {" · "}
                <Link href={`/assessments/${assessment.supersedes_id}`} className="underline-offset-4 hover:underline">
                  Re-evaluation of an earlier version
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canRun ? (
            <RunAnalysisButton
              assessmentId={assessment.id}
              label={assessment.status === "draft" ? "Run analysis" : "Re-run analysis"}
            />
          ) : null}
          {isInReview && assessment.mappings.length > 0 ? (
            <CompleteAssessmentButton assessmentId={assessment.id} pendingCount={metrics.pending} />
          ) : null}
          {assessment.status === "completed" ? (
            <ReopenAssessmentButton assessmentId={assessment.id} />
          ) : null}
        </div>
      </div>

      {assessment.superseded_by_id ? (
        <Alert>
          <AlertTitle>Superseded</AlertTitle>
          <AlertDescription>
            This version was re-evaluated.{" "}
            <Link href={`/assessments/${assessment.superseded_by_id}`} className="underline underline-offset-4">
              Open the current assessment
            </Link>
            . This page is kept read-only as history.
          </AlertDescription>
        </Alert>
      ) : null}

      {isStale ? (
        <StaleAlert
          assessmentId={assessment.id}
          reasons={staleReasons.map(describeStaleReason)}
          fromOptions={fromOptions}
          defaultFromId={assessment.from_version.id}
          latestLabel={latestVersion ? `#${latestVersion.version_number} ${latestVersion.label}` : "latest"}
          canReevaluate={hasResults && !assessment.superseded_by_id}
        />
      ) : null}

      {assessment.status === "failed" && assessment.ai_error ? (
        <Alert variant="destructive">
          <AlertTitle>Analysis failed</AlertTitle>
          <AlertDescription>{assessment.ai_error}</AlertDescription>
        </Alert>
      ) : null}

      {assessment.status === "draft" ? (
        <Alert>
          <AlertTitle>Ready to analyze</AlertTitle>
          <AlertDescription>
            Running the analysis diffs the two policy versions, sends only the
            differing paragraphs and the active control register to the AI
            model, and returns changed requirements with citations, affected
            controls, evidence flags, and any questions it needs answered.
          </AlertDescription>
        </Alert>
      ) : null}

      {assessment.status === "analyzing" ? (
        <Alert>
          <AlertTitle>Analysis in progress</AlertTitle>
          <AlertDescription>Refresh this page in a moment.</AlertDescription>
        </Alert>
      ) : null}

      {hasResults ? (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Counts</h2>
            <p className="text-sm text-muted-foreground">
              Computed from reviewer decisions only. Pending and rejected
              mappings do not count. A mapped control is compliant when every
              accepted impact on it is resolved: no action required, all
              remediation actions done, or an active risk acceptance.
            </p>
          </div>
          <MetricsGrid metrics={metrics} />
          <SecondaryMetrics metrics={metrics} />
        </section>
      ) : null}

      {assessment.ai_summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Agent summary</CardTitle>
            <CardDescription>
              Proposed by the agent against the supplied policy only. Not a
              statement of formal compliance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{assessment.ai_summary}</p>
          </CardContent>
        </Card>
      ) : null}

      {hasResults ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Changed requirements</h2>
            <ChangesList
              changes={assessment.changes}
              mappedChangeIds={mappedChangeIds}
              fromLabel={assessment.from_version.label}
              toLabel={assessment.to_version.label}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Affected controls</h2>
              {isInReview ? (
                <AddMappingForm
                  assessmentId={assessment.id}
                  changes={changeOptions}
                  controls={controlOptions}
                />
              ) : null}
            </div>
            <MappingsList
              mappings={assessment.mappings}
              changes={assessment.changes}
              ownerNames={ownerNames}
              renderReview={
                isInReview
                  ? (m) => (
                      <ReviewControls
                        mappingId={m.id}
                        assessmentId={assessment.id}
                        reviewStatus={m.review_status}
                        aiLevel={m.ai_impact_level}
                        noActionRequired={m.no_action_required}
                      />
                    )
                  : undefined
              }
              renderResolution={(m) =>
                isEffective(m.review_status) ? (
                  <ResolutionPanel
                    assessmentId={assessment.id}
                    mappingId={m.id}
                    suggestedRemediation={m.suggested_remediation}
                    defaultOwnerId={m.control.owner_id}
                    defaultOwnerName={m.control.owner_name}
                    owners={ownerChoices}
                    actions={actionsByMapping.get(m.id) ?? []}
                    acceptances={acceptancesByMapping.get(m.id) ?? []}
                    ownerNames={ownerNames}
                    resolved={metrics.mappingResolved.get(m.id) === true}
                    noActionRequired={m.no_action_required}
                    editable={canRemediate}
                  />
                ) : null
              }
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Questions from the agent</h2>
            <QuestionsPanel
              assessmentId={assessment.id}
              questions={assessment.questions}
              controlLabels={controlLabels}
              readOnly={!isInReview}
            />
          </section>
        </>
      ) : null}

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Decision and change history</h2>
          <p className="text-sm text-muted-foreground">
            Everything recorded about this assessment and its mappings, actions,
            risk acceptances, and questions. Newest first.
          </p>
        </div>
        <Card>
          <CardContent className="px-0">
            <AuditTable entries={history} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
