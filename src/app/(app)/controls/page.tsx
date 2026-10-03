import type { Metadata } from "next";
import Link from "next/link";
import { RemediationStatusBadge } from "@/components/controls/status-badge";
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
import { listControls, ownerDisplayName } from "@/lib/controls/queries";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Controls" };

export default async function ControlsPage(props: PageProps<"/controls">) {
  const searchParams = await props.searchParams;
  const showInactive = searchParams.inactive === "1";
  const controls = await listControls({ includeInactive: showInactive });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Control register</h1>
          <p className="text-sm text-muted-foreground">
            The bounded set of controls, processes, or systems that policies are
            assessed against.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/controls/import" />}
          >
            Import CSV
          </Button>
          <Button nativeButton={false} render={<Link href="/controls/new" />}>
            New control
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground">
          {controls.length} {controls.length === 1 ? "control" : "controls"}
        </span>
        <Link
          href={showInactive ? "/controls" : "/controls?inactive=1"}
          className="underline underline-offset-4"
        >
          {showInactive ? "Hide inactive" : "Show inactive"}
        </Link>
      </div>

      {controls.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <p className="font-medium">No controls yet</p>
            <p className="text-sm text-muted-foreground">
              Add controls one at a time or import your register from a CSV
              file with owners, evidence, and current remediation status.
            </p>
            <div className="flex gap-2">
              <Button nativeButton={false} render={<Link href="/controls/new" />}>
                Add a control
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/controls/import" />}
              >
                Import CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref</TableHead>
                <TableHead>Control</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Evidence</TableHead>
                <TableHead>Latest evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controls.map((control) => (
                <TableRow key={control.id} className={control.is_active ? "" : "opacity-60"}>
                  <TableCell className="font-mono text-xs">{control.control_ref}</TableCell>
                  <TableCell>
                    <Link
                      href={`/controls/${control.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {control.title}
                    </Link>
                    <div className="flex items-center gap-2">
                      {control.category ? (
                        <span className="text-xs text-muted-foreground">
                          {control.category}
                        </span>
                      ) : null}
                      {!control.is_active ? (
                        <Badge variant="outline">Inactive</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{ownerDisplayName(control.owner, control.owner_name)}</TableCell>
                  <TableCell>
                    <RemediationStatusBadge status={control.remediation_status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {control.evidence_count}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(control.latest_evidence_date)}
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
