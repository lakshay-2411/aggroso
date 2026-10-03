"use client";

import { useActionState, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { createAssessment } from "@/lib/assessments/actions";
import type { VersionRef } from "@/lib/assessments/queries";

interface PolicyOption {
  id: string;
  title: string;
  versions: VersionRef[]; // newest first
}

export function NewAssessmentForm({ policies }: { policies: PolicyOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createAssessment,
    initialActionState,
  );
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const policy = policies.find((p) => p.id === policyId) ?? null;
  const [toVersionId, setToVersionId] = useState(policy?.versions[0]?.id ?? "");
  const [fromVersionId, setFromVersionId] = useState(policy?.versions[1]?.id ?? "");

  function onPolicyChange(nextId: string) {
    setPolicyId(nextId);
    const next = policies.find((p) => p.id === nextId);
    setToVersionId(next?.versions[0]?.id ?? "");
    setFromVersionId(next?.versions[1]?.id ?? "");
  }

  const label = (v: VersionRef) => `#${v.version_number} · ${v.label}`;

  return (
    <form action={formAction}>
      <Card>
        <CardHeader>
          <CardTitle>Assessment scope</CardTitle>
          <CardDescription>
            Pick the policy and the two versions to compare. The register of
            active controls at the time of analysis is used.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="policyId">Policy</Label>
            <NativeSelect
              id="policyId"
              name="policyId"
              value={policyId}
              onChange={(e) => onPolicyChange(e.target.value)}
              required
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="fromVersionId">Previous version</Label>
              <NativeSelect
                id="fromVersionId"
                name="fromVersionId"
                value={fromVersionId}
                onChange={(e) => setFromVersionId(e.target.value)}
                required
              >
                {(policy?.versions ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {label(v)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="toVersionId">New version</Label>
              <NativeSelect
                id="toVersionId"
                name="toVersionId"
                value={toVersionId}
                onChange={(e) => setToVersionId(e.target.value)}
                required
              >
                {(policy?.versions ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {label(v)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="pt-6">
          <Button type="submit" disabled={pending || !policy}>
            {pending ? "Creating..." : "Create assessment"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
