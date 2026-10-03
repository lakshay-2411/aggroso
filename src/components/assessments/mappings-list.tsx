import Link from "next/link";
import { ImpactBadge, ReviewStatusBadge } from "@/components/assessments/badges";
import { RemediationStatusBadge } from "@/components/controls/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MappingWithControl } from "@/lib/assessments/queries";
import type { RequirementChangeRow } from "@/lib/supabase/database.types";

interface MappingsListProps {
  mappings: MappingWithControl[];
  changes: RequirementChangeRow[];
  ownerNames: Map<string, string>;
  /** Optional per-mapping review controls, rendered under each mapping. */
  renderReview?: (mapping: MappingWithControl) => React.ReactNode;
  /** Optional per-mapping remediation / risk acceptance block. */
  renderResolution?: (mapping: MappingWithControl) => React.ReactNode;
}

export function MappingsList({
  mappings,
  changes,
  ownerNames,
  renderReview,
  renderResolution,
}: MappingsListProps) {
  if (mappings.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No controls were linked to the changes.
        </CardContent>
      </Card>
    );
  }

  const changeById = new Map(changes.map((c) => [c.id, c]));

  // Group by control, confirmed before possible, then by control ref.
  const groups = new Map<string, { control: MappingWithControl["control"]; items: MappingWithControl[] }>();
  for (const m of mappings) {
    const group = groups.get(m.control_id) ?? { control: m.control, items: [] };
    group.items.push(m);
    groups.set(m.control_id, group);
  }
  const ordered = [...groups.values()].sort((a, b) =>
    a.control.control_ref.localeCompare(b.control.control_ref, undefined, { numeric: true }),
  );

  return (
    <div className="flex flex-col gap-4">
      {ordered.map(({ control, items }) => {
        const owner =
          (control.owner_id ? ownerNames.get(control.owner_id) : null) ??
          control.owner_name ??
          "Unassigned";
        const hasConfirmed = items.some(
          (m) => (m.final_impact_level ?? m.ai_impact_level) === "confirmed" && m.review_status !== "rejected",
        );
        return (
          <Card key={control.id} id={`control-${control.id}`}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{control.control_ref}</span>
                <RemediationStatusBadge status={control.remediation_status} />
                {!control.is_active ? <Badge variant="outline">Inactive</Badge> : null}
                {hasConfirmed ? <ImpactBadge level="confirmed" /> : <ImpactBadge level="possible" />}
              </div>
              <CardTitle className="text-base">
                <Link href={`/controls/${control.id}`} className="underline-offset-4 hover:underline">
                  {control.title}
                </Link>
              </CardTitle>
              <CardDescription>Owner: {owner}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {items.map((m) => {
                const change = changeById.get(m.requirement_change_id);
                const effectiveLevel = m.final_impact_level ?? m.ai_impact_level;
                return (
                  <div key={m.id} id={`mapping-${m.id}`} className="flex flex-col gap-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ImpactBadge level={effectiveLevel} />
                      {m.final_impact_level && m.final_impact_level !== m.ai_impact_level ? (
                        <span className="text-xs text-muted-foreground">
                          (agent said {m.ai_impact_level})
                        </span>
                      ) : null}
                      <ReviewStatusBadge status={m.review_status} />
                      {m.evidence_outdated ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                          Evidence may be outdated
                        </Badge>
                      ) : null}
                    </div>
                    {change ? (
                      <p className="text-sm">
                        <a href={`#change-${change.id}`} className="font-medium underline-offset-4 hover:underline">
                          C{change.position + 1} · {change.title}
                        </a>
                        {change.new_section_ref ? (
                          <span className="ml-1 font-mono text-xs text-muted-foreground">
                            § {change.new_section_ref}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Why: </span>
                      {m.ai_rationale}
                    </p>
                    {m.evidence_rationale ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Evidence: </span>
                        {m.evidence_rationale}
                      </p>
                    ) : null}
                    {m.suggested_remediation ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Suggested remediation: </span>
                        {m.suggested_remediation}
                      </p>
                    ) : null}
                    {m.reviewer_note ? (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Reviewer note: </span>
                        {m.reviewer_note}
                      </p>
                    ) : null}
                    {renderReview ? renderReview(m) : null}
                    {renderResolution ? renderResolution(m) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
