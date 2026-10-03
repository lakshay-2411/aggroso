import type { Metadata } from "next";
import Link from "next/link";
import { AssessmentStatusBadge, StaleBadge } from "@/components/assessments/badges";
import { MetricsGrid } from "@/components/assessments/metrics-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { computeAssessmentMetrics, type AssessmentMetrics } from "@/lib/assessments/metrics";
import { listDashboardAssessments } from "@/lib/assessments/queries";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const assessments = await listDashboardAssessments();

  const rows = assessments.map((a) => ({
    ...a,
    metrics: computeAssessmentMetrics(a.metricsInput),
  }));

  // Totals across assessments that are not stale. Stale ones are listed but
  // excluded so the headline numbers never rest on outdated analysis.
  const current = rows.filter((r) => !r.is_stale);
  const totals: AssessmentMetrics = current.reduce<AssessmentMetrics>(
    (acc, r) => ({
      mapped: acc.mapped + r.metrics.mapped,
      unmapped: acc.unmapped + r.metrics.unmapped,
      compliant: acc.compliant + r.metrics.compliant,
      unresolved: acc.unresolved + r.metrics.unresolved,
      pending: acc.pending + r.metrics.pending,
      rejected: acc.rejected + r.metrics.rejected,
      confirmed: acc.confirmed + r.metrics.confirmed,
      possible: acc.possible + r.metrics.possible,
      unmappedChanges: acc.unmappedChanges + r.metrics.unmappedChanges,
      controlStates: acc.controlStates,
      mappingResolved: acc.mappingResolved,
    }),
    {
      mapped: 0,
      unmapped: 0,
      compliant: 0,
      unresolved: 0,
      pending: 0,
      rejected: 0,
      confirmed: 0,
      possible: 0,
      unmappedChanges: 0,
      controlStates: new Map(),
      mappingResolved: new Map(),
    },
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Totals across {current.length} current{" "}
            {current.length === 1 ? "assessment" : "assessments"}. Counts come
            from reviewer decisions, never from the AI directly.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/assessments/new" />}>
          New assessment
        </Button>
      </div>

      <MetricsGrid metrics={totals} />

      <Card>
        <CardHeader>
          <CardTitle>Assessments</CardTitle>
          <CardDescription>
            {totals.pending > 0
              ? `${totals.pending} mapping${totals.pending === 1 ? "" : "s"} still need a reviewer decision.`
              : "Every mapping has a reviewer decision."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No analysed assessments yet. Create one from a policy with two
              versions and run the analysis.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Mapped</TableHead>
                  <TableHead className="text-right">Unmapped</TableHead>
                  <TableHead className="text-right">Compliant</TableHead>
                  <TableHead className="text-right">Unresolved</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Analyzed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className={r.is_stale ? "opacity-70" : undefined}>
                    <TableCell>
                      <Link
                        href={`/assessments/${r.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {r.policy_title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {r.from_label} → {r.to_label}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <AssessmentStatusBadge status={r.status} />
                        {r.is_stale ? <StaleBadge /> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.metrics.mapped}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.metrics.unmapped}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.metrics.compliant}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.metrics.unresolved}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.metrics.pending}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(r.analyzed_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
