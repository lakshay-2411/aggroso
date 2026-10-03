import type { Metadata } from "next";
import Link from "next/link";
import { NewAssessmentForm } from "@/components/assessments/new-assessment-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { listPoliciesWithVersions } from "@/lib/assessments/queries";

export const metadata: Metadata = { title: "New assessment" };

export default async function NewAssessmentPage() {
  const policies = await listPoliciesWithVersions();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/assessments"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Assessments
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New assessment</h1>
      </div>

      {policies.length === 0 ? (
        <Alert>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>
              No policy has two or more versions yet. Add the new version of a
              policy first, then come back to assess the change.
            </span>
            <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/policies" />}>
              Go to policies
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <NewAssessmentForm policies={policies} />
      )}
    </div>
  );
}
