import type { Metadata } from "next";
import Link from "next/link";
import { AuditTable } from "@/components/audit/audit-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { ENTITY_TYPES, ENTITY_TYPE_LABELS, isEntityType } from "@/lib/audit-log/labels";
import { AUDIT_PAGE_SIZE, listAuditEntries } from "@/lib/audit-log/queries";

export const metadata: Metadata = { title: "Audit history" };

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function AuditPage(props: PageProps<"/audit">) {
  const sp = await props.searchParams;
  const typeParam = first(sp.type);
  const entityType = isEntityType(typeParam) ? typeParam : undefined;
  const action = first(sp.action);
  const actor = first(sp.actor);
  const page = Math.max(1, Number.parseInt(first(sp.page) || "1", 10) || 1);

  const result = await listAuditEntries({ entityType, action, actor, page });

  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (entityType) params.set("type", entityType);
    if (action) params.set("action", action);
    if (actor) params.set("actor", actor);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/audit?${qs}` : "/audit";
  };

  const start = result.total === 0 ? 0 : (result.page - 1) * AUDIT_PAGE_SIZE + 1;
  const end = Math.min(result.total, result.page * AUDIT_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit history</h1>
        <p className="text-sm text-muted-foreground">
          Every decision and change, append-only. Entries cannot be edited or
          deleted, even by administrators.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="type" className="text-xs">
            Record type
          </Label>
          <NativeSelect id="type" name="type" defaultValue={entityType ?? ""} className="w-48">
            <option value="">All types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {ENTITY_TYPE_LABELS[t]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="action" className="text-xs">
            Action contains
          </Label>
          <Input id="action" name="action" defaultValue={action} placeholder="e.g. review" className="w-44" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="actor" className="text-xs">
            Actor email contains
          </Label>
          <Input id="actor" name="actor" defaultValue={actor} className="w-52" />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
        {entityType || action || actor ? (
          <Button variant="ghost" nativeButton={false} render={<Link href="/audit" />}>
            Clear
          </Button>
        ) : null}
      </form>

      <Card>
        <CardContent className="px-0">
          <AuditTable entries={result.entries} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {start}–{end} of {result.total}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={result.page <= 1}
            nativeButton={result.page <= 1}
            render={result.page > 1 ? <Link href={buildHref(result.page - 1)} /> : undefined}
          >
            Previous
          </Button>
          <span className="self-center">
            Page {result.page} of {result.pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={result.page >= result.pageCount}
            nativeButton={result.page >= result.pageCount}
            render={result.page < result.pageCount ? <Link href={buildHref(result.page + 1)} /> : undefined}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
