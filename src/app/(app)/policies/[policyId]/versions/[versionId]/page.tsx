import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { getPolicy, getPolicyVersion } from "@/lib/policies/queries";

type Props = PageProps<"/policies/[policyId]/versions/[versionId]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { policyId, versionId } = await props.params;
  const version = await getPolicyVersion(policyId, versionId);
  return { title: version ? `Version #${version.version_number}` : "Version" };
}

export default async function PolicyVersionPage(props: Props) {
  const { policyId, versionId } = await props.params;
  const [policy, version] = await Promise.all([
    getPolicy(policyId),
    getPolicyVersion(policyId, versionId),
  ]);
  if (!policy || !version) notFound();

  const index = policy.versions.findIndex((v) => v.id === version.id);
  const newer = index > 0 ? policy.versions[index - 1] : null;
  const older =
    index >= 0 && index < policy.versions.length - 1
      ? policy.versions[index + 1]
      : null;
  const isLatest = index === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href={`/policies/${policy.id}`}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← {policy.title}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Version #{version.version_number} · {version.label}
            </h1>
            {isLatest ? <Badge variant="secondary">Latest</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Effective {formatDate(version.effective_date)} · Added{" "}
            {formatDateTime(version.created_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!older}
            nativeButton={!older}
            render={
              older ? (
                <Link href={`/policies/${policy.id}/versions/${older.id}`} />
              ) : undefined
            }
          >
            ← Older
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!newer}
            nativeButton={!newer}
            render={
              newer ? (
                <Link href={`/policies/${policy.id}/versions/${newer.id}`} />
              ) : undefined
            }
          >
            Newer →
          </Button>
        </div>
      </div>

      {version.change_summary ? (
        <Card>
          <CardHeader>
            <CardTitle>Change summary</CardTitle>
            <CardDescription>As entered when this version was added.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{version.change_summary}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Policy text</CardTitle>
          <CardDescription>
            Immutable snapshot. Assessments cite sections from this exact text.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[70vh] overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {version.content}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
