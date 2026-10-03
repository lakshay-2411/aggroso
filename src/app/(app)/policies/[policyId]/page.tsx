import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PolicyDetailsForm } from "@/components/policies/policy-details-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatDateTime } from "@/lib/format";
import { getPolicy } from "@/lib/policies/queries";

export async function generateMetadata(
  props: PageProps<"/policies/[policyId]">,
): Promise<Metadata> {
  const { policyId } = await props.params;
  const policy = await getPolicy(policyId);
  return { title: policy?.title ?? "Policy" };
}

export default async function PolicyPage(props: PageProps<"/policies/[policyId]">) {
  const { policyId } = await props.params;
  const policy = await getPolicy(policyId);
  if (!policy) notFound();

  const latest = policy.versions[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href="/policies"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← All policies
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{policy.title}</h1>
          {policy.description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {policy.description}
            </p>
          ) : null}
        </div>
        <Button
          nativeButton={false}
          render={<Link href={`/policies/${policy.id}/versions/new`} />}
        >
          Add new version
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Version history</CardTitle>
            <CardDescription>
              {policy.versions.length === 1
                ? "One version so far. Add the new version to assess the change."
                : `${policy.versions.length} versions, newest first. Every version is preserved.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Effective</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policy.versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell>
                      <Link
                        href={`/policies/${policy.id}/versions/${version.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        #{version.version_number}
                      </Link>
                      {latest?.id === version.id ? (
                        <Badge variant="secondary" className="ml-2">
                          Latest
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {version.label}
                      {version.change_summary ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {version.change_summary}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(version.effective_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(version.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              Title and description only. Version text cannot be edited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyDetailsForm
              policyId={policy.id}
              title={policy.title}
              description={policy.description}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
