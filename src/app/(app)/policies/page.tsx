import type { Metadata } from "next";
import Link from "next/link";
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
import { formatDateTime } from "@/lib/format";
import { listPolicies } from "@/lib/policies/queries";

export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage() {
  const policies = await listPolicies();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Each policy keeps every version it has ever had. Versions are never
            edited or deleted.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/policies/new" />}>
          New policy
        </Button>
      </div>

      {policies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 py-10">
            <p className="font-medium">No policies yet</p>
            <p className="text-sm text-muted-foreground">
              Create a policy and paste its current text as the first version.
              Add the new version later to assess what changed.
            </p>
            <Button nativeButton={false} render={<Link href="/policies/new" />}>
              Create your first policy
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Latest version</TableHead>
                <TableHead className="text-right">Versions</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <Link
                      href={`/policies/${policy.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {policy.title}
                    </Link>
                    {policy.description ? (
                      <p className="line-clamp-1 text-xs text-muted-foreground">
                        {policy.description}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {policy.latest_version ? (
                      <Badge variant="secondary">
                        #{policy.latest_version.version_number} ·{" "}
                        {policy.latest_version.label}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {policy.version_count}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(policy.updated_at)}
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
