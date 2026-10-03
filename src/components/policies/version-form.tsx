"use client";

import { useActionState } from "react";
import { VersionFields } from "@/components/policies/policy-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { addPolicyVersion } from "@/lib/policies/actions";

interface VersionFormProps {
  policyId: string;
  nextVersionNumber: number;
}

export function VersionForm({ policyId, nextVersionNumber }: VersionFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addPolicyVersion,
    initialActionState,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="policyId" value={policyId} />
      <Card>
        <CardHeader>
          <CardTitle>New version #{nextVersionNumber}</CardTitle>
          <CardDescription>
            Paste the complete updated policy text. Previous versions are kept
            unchanged, and any assessment made against an older version will be
            flagged as stale.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <VersionFields />
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-3 pt-6">
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : "Save version"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
