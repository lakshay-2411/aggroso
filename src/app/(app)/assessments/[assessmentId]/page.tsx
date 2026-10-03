import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssessmentStatusBadge, StaleBadge } from "@/components/assessments/badges";
import { ChangesList } from "@/components/assessments/changes-list";
import { MappingsList } from "@/components/assessments/mappings-list";
import { QuestionsPanel } from "@/components/assessments/questions-panel";
import { RunAnalysisButton } from "@/components/assessments/run-analysis-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAssessment } from "@/lib/assessments/queries";
import { formatDateTime } from "@/lib/format";

type Props = PageProps<"/assessments/[assessmentId]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { assessmentId } = await props.params;
  const assessment = await getAssessment(assessmentId);
  return { title: assessment ? `Assessment · ${assessment.policy.title}` : "Assessment" };
}

export default async function AssessmentPage(props: Props) {
  const { assessmentId } = await props.params;
  const assessment = await getAssessment(assessmentId);
  if (!assessment) notFound();

  const mappedChangeIds = new Set(assessment.mappings.map((m) => m.requirement_change_id));
  const ownerNames = new Map(
    [...assessment.profiles.values()].map((p) => [p.id, p.full_name ?? p.email]),
  );
  const controlLabels = new Map(
    assessment.mappings.map((m) => [m.control_id, `${m.control.control_ref} ${m.control.title}`]),
  );

  const confirmed = assessment.mappings.filter(
    (m) => (m.final_impact_level ?? m.ai_impact_level) === "confirmed",
  ).length;
  const possible = assessment.mappings.length - confirmed;
  const outdatedEvidence = assessment.mappings.filter((m) => m.evidence_outdated).length;
  const unmappedChanges = assessment.changes.filter((c) => !mappedChangeIds.has(c.id)).length;
  const openQuestions = assessment.questions.filter((q) => !q.answer).length;
  const canRun =
    assessment.status === "draft" ||
    assessment.status === "failed" ||
    (assessment.status === "in_review" &&
      assessment.mappings.every((m) => m.review_status === "pending"));

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
            {assessment.is_stale ? <StaleBadge /> : null}
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
            {assessment.ai_model ? ` · ${assessment.ai_model}` : null}
          </p>
        </div>
        {canRun ? (
          <RunAnalysisButton
            assessmentId={assessment.id}
            label={assessment.status === "draft" ? "Run analysis" : "Re-run analysis"}
          />
        ) : null}
      </div>

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
            Running the analysis sends both policy versions and the active control
            register to the AI model. It extracts changed requirements with citations,
            maps them to controls, flags evidence that may be outdated, and lists
            any context it needs from you.
          </AlertDescription>
        </Alert>
      ) : null}

      {assessment.status === "analyzing" ? (
        <Alert>
          <AlertTitle>Analysis in progress</AlertTitle>
          <AlertDescription>Refresh this page in a moment.</AlertDescription>
        </Alert>
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
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm whitespace-pre-wrap">{assessment.ai_summary}</p>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Changes" value={assessment.changes.length} />
              <Stat label="Unmapped changes" value={unmappedChanges} />
              <Stat label="Confirmed impacts" value={confirmed} />
              <Stat label="Possible impacts" value={possible} />
              <Stat label="Outdated evidence" value={outdatedEvidence} />
              <Stat label="Open questions" value={openQuestions} />
            </dl>
          </CardContent>
        </Card>
      ) : null}

      {assessment.status !== "draft" && assessment.status !== "analyzing" ? (
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
            <h2 className="text-lg font-semibold">Affected controls</h2>
            <MappingsList
              mappings={assessment.mappings}
              changes={assessment.changes}
              ownerNames={ownerNames}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Questions from the agent</h2>
            <QuestionsPanel
              assessmentId={assessment.id}
              questions={assessment.questions}
              controlLabels={controlLabels}
              readOnly={assessment.status === "completed"}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
