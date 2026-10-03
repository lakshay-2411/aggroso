import type { Metadata } from "next";
import Link from "next/link";
import { AssessmentStatusBadge, StaleBadge } from "@/components/assessments/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAssessments } from "@/lib/assessments/queries";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Assessments" };

export default async function AssessmentsPage() {
  const assessments = await listAssessments();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
          <p className="text-sm text-muted-foreground">
            Each assessment compares two versions of a policy against the control
            register. Results are proposals until a reviewer decides on them.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/assessments/new" />}>
          New assessment
        </Button>
      </div>

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <p className="font-medium">No assessments yet</p>
            <p className="text-sm text-muted-foreground">
              You need a policy with at least two versions and some controls in
              the register. Then create an assessment and run the analysis.
            </p>
            <Button nativeButton={false} render={<Link href="/assessments/new" />}>
              Create an assessment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Changes</TableHead>
                <TableHead className="text-right">Mappings</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link
                      href={`/assessments/${a.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {a.policy.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Assessment v{a.assessment_version}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    #{a.from_version.version_number} → #{a.to_version.version_number}
                    <p className="text-xs text-muted-foreground">
                      {a.from_version.label} → {a.to_version.label}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <AssessmentStatusBadge status={a.status} />
                      {a.is_stale && !a.superseded_by_id ? <StaleBadge /> : null}
                      {a.superseded_by_id ? <Badge variant="outline">Superseded</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.change_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.mapping_count}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.pending_count}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(a.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
