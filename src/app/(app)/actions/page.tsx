import type { Metadata } from "next";
import Link from "next/link";
import { ActionStatusBadge } from "@/components/remediation/action-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listRemediationActions } from "@/lib/assessments/queries";
import { formatDate, formatDateTime } from "@/lib/format";
import { ACTION_STATUS_LABELS } from "@/lib/remediation/constants";
import type { ActionStatus } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Remediation actions" };

const FILTERS: { key: string; label: string; statuses: ActionStatus[] }[] = [
  { key: "open", label: "Open", statuses: ["open", "in_progress"] },
  { key: "done", label: "Done", statuses: ["done"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
  { key: "all", label: "All", statuses: ["open", "in_progress", "done", "cancelled"] },
];

export default async function ActionsPage(props: PageProps<"/actions">) {
  const searchParams = await props.searchParams;
  const filterKey = typeof searchParams.filter === "string" ? searchParams.filter : "open";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  const all = await listRemediationActions();
  const actions = all.filter((a) => filter.statuses.includes(a.status));
  const today = new Date().toISOString().slice(0, 10);
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.key, all.filter((a) => f.statuses.includes(a.status)).length]),
  ) as Record<string, number>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Remediation actions</h1>
        <p className="text-sm text-muted-foreground">
          Every approved action across assessments, with its owner and status.
          Update an action from its assessment page.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "open" ? "/actions" : `/actions?filter=${f.key}`}
            className={
              f.key === filter.key
                ? "rounded-md bg-muted px-3 py-1 font-medium"
                : "rounded-md px-3 py-1 text-muted-foreground hover:bg-muted/60"
            }
          >
            {f.label} ({counts[f.key]})
          </Link>
        ))}
      </div>

      <Card>
        {actions.length === 0 ? (
          <CardContent className="py-10 text-sm text-muted-foreground">
            No {filter.label.toLowerCase()} actions.
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Control</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((a) => {
                const overdue =
                  a.due_date !== null && a.due_date < today && (a.status === "open" || a.status === "in_progress");
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link
                        href={`/assessments/${a.assessment_id}#mapping-${a.impact_mapping_id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {a.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{a.policy_title}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{a.control_ref}</span>{" "}
                      <span className="text-sm">{a.control_title}</span>
                    </TableCell>
                    <TableCell>{a.owner_label}</TableCell>
                    <TableCell>
                      <ActionStatusBadge status={a.status} />
                    </TableCell>
                    <TableCell className={overdue ? "font-medium text-destructive" : "text-muted-foreground"}>
                      {formatDate(a.due_date)}
                      {overdue ? " · overdue" : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(a.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        Statuses: {Object.values(ACTION_STATUS_LABELS).join(", ")}.
      </p>
    </div>
  );
}
