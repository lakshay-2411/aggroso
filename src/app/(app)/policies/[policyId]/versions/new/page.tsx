import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VersionForm } from "@/components/policies/version-form";
import { getPolicy } from "@/lib/policies/queries";

export const metadata: Metadata = { title: "Add policy version" };

export default async function NewVersionPage(
  props: PageProps<"/policies/[policyId]/versions/new">,
) {
  const { policyId } = await props.params;
  const policy = await getPolicy(policyId);
  if (!policy) notFound();

  const nextVersionNumber = (policy.versions[0]?.version_number ?? 0) + 1;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/policies/${policy.id}`}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← {policy.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add new version</h1>
      </div>
      <VersionForm policyId={policy.id} nextVersionNumber={nextVersionNumber} />
    </div>
  );
}
