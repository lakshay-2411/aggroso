import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AssessmentMetrics } from "@/lib/assessments/metrics";

const primary: { key: keyof AssessmentMetrics; label: string; hint: string }[] = [
  { key: "mapped", label: "Mapped", hint: "Controls with an accepted impact" },
  { key: "unmapped", label: "Unmapped", hint: "Controls with no accepted impact" },
  { key: "compliant", label: "Compliant", hint: "Mapped controls fully resolved" },
  { key: "unresolved", label: "Unresolved", hint: "Mapped controls with open items" },
];

export function MetricsGrid({ metrics, compact }: { metrics: AssessmentMetrics; compact?: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {primary.map((item) => (
        <Card key={item.key} className={compact ? "py-4" : undefined}>
          <CardHeader className={compact ? "px-4" : undefined}>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{metrics[item.key] as number}</CardTitle>
            {!compact ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function SecondaryMetrics({ metrics }: { metrics: AssessmentMetrics }) {
  const items = [
    { label: "Pending review", value: metrics.pending },
    { label: "Rejected", value: metrics.rejected },
    { label: "Confirmed impacts", value: metrics.confirmed },
    { label: "Possible impacts", value: metrics.possible },
    { label: "Unmapped changes", value: metrics.unmappedChanges },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border p-3">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-xl font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
