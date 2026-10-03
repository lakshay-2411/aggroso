import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditEntityType } from "@/lib/audit";
import { ENTITY_TYPE_LABELS, actionLabel, isEntityType } from "@/lib/audit-log/labels";
import { formatDateTime } from "@/lib/format";
import type { AuditLogRow, Json } from "@/lib/supabase/database.types";

function detailsOf(entry: AuditLogRow): Record<string, Json | undefined> {
  const d = entry.details;
  return d && typeof d === "object" && !Array.isArray(d) ? d : {};
}

function str(value: Json | undefined): string | null {
  return typeof value === "string" ? value : null;
}

/** Best-effort link to the record an entry is about. */
function entityHref(entry: AuditLogRow): string | null {
  const d = detailsOf(entry);
  const type = entry.entity_type as AuditEntityType;
  switch (type) {
    case "policy":
      return `/policies/${entry.entity_id}`;
    case "policy_version": {
      const policyId = str(d.policy_id);
      return policyId ? `/policies/${policyId}/versions/${entry.entity_id}` : null;
    }
    case "control":
      return `/controls/${entry.entity_id}`;
    case "control_evidence": {
      const controlId = str(d.control_id);
      return controlId ? `/controls/${controlId}` : null;
    }
    case "assessment":
      return `/assessments/${entry.entity_id}`;
    case "impact_mapping": {
      const assessmentId = str(d.assessment_id);
      return assessmentId ? `/assessments/${assessmentId}#mapping-${entry.entity_id}` : null;
    }
    case "remediation_action":
    case "risk_acceptance": {
      const assessmentId = str(d.assessment_id);
      const mappingId = str(d.impact_mapping_id);
      return assessmentId
        ? `/assessments/${assessmentId}${mappingId ? `#mapping-${mappingId}` : ""}`
        : null;
    }
    case "context_question": {
      const assessmentId = str(d.assessment_id);
      return assessmentId ? `/assessments/${assessmentId}` : null;
    }
    default:
      return null;
  }
}

const HIDDEN_KEYS = new Set([
  "assessment_id",
  "policy_id",
  "control_id",
  "impact_mapping_id",
  "requirement_change_id",
  "from_assessment_id",
  "from_mapping_id",
  "superseded_by_id",
  "supersedes_id",
  "from_version_id",
  "to_version_id",
  "owner_id",
  "version_id",
]);

function renderValue(value: Json | undefined): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Compact, human-readable rendering of an entry's details. */
function Details({ entry }: { entry: AuditLogRow }) {
  const d = detailsOf(entry);
  const keys = Object.keys(d).filter((k) => !HIDDEN_KEYS.has(k));
  if (keys.length === 0) return <span className="text-muted-foreground">—</span>;

  const simple = keys.filter((k) => {
    const v = d[k];
    return v === null || typeof v !== "object";
  });
  const complex = keys.filter((k) => !simple.includes(k));

  return (
    <div className="flex max-w-xl flex-col gap-1 text-xs">
      {simple.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          {simple.map((k) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
              <dd className="truncate" title={renderValue(d[k])}>
                {renderValue(d[k])}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {complex.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            {complex.map((k) => k.replace(/_/g, " ")).join(", ")}
          </summary>
          <pre className="mt-1 max-h-60 overflow-auto rounded border bg-muted/30 p-2 font-mono text-[11px] whitespace-pre-wrap">
            {JSON.stringify(Object.fromEntries(complex.map((k) => [k, d[k]])), null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

export function AuditTable({
  entries,
  showEntity = true,
}: {
  entries: AuditLogRow[];
  showEntity?: boolean;
}) {
  if (entries.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">No history recorded.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-44">When</TableHead>
          <TableHead>Who</TableHead>
          <TableHead>What</TableHead>
          {showEntity ? <TableHead>Record</TableHead> : null}
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const href = entityHref(entry);
          const typeLabel = isEntityType(entry.entity_type)
            ? ENTITY_TYPE_LABELS[entry.entity_type]
            : entry.entity_type;
          return (
            <TableRow key={entry.id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(entry.created_at)}
              </TableCell>
              <TableCell className="max-w-48 truncate" title={entry.actor_email ?? undefined}>
                {entry.actor_email ?? "system"}
              </TableCell>
              <TableCell className="font-medium">{actionLabel(entry.action)}</TableCell>
              {showEntity ? (
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant="outline" className="w-fit">
                      {typeLabel}
                    </Badge>
                    {href ? (
                      <Link href={href} className="font-mono text-[11px] text-muted-foreground underline-offset-4 hover:underline">
                        {entry.entity_id.slice(0, 8)}…
                      </Link>
                    ) : (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {entry.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </TableCell>
              ) : null}
              <TableCell>
                <Details entry={entry} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
