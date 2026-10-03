"use client";

import { useActionState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { createPolicy } from "@/lib/policies/actions";

export function PolicyForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createPolicy,
    initialActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Policy</CardTitle>
          <CardDescription>
            A policy groups every version of one document, for example an
            Information Security Policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={200} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" rows={2} maxLength={2000} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>First version</CardTitle>
          <CardDescription>
            Paste the full policy text. Keep section numbers or headings in
            the text so changes can be cited precisely later.
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
            {pending ? "Creating..." : "Create policy"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

/** Shared inputs for a policy version. Used by create and add-version forms. */
export function VersionFields({ defaultLabel }: { defaultLabel?: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="label">Version label</Label>
          <Input
            id="label"
            name="label"
            placeholder="e.g. v1.0 or 2026-Q4"
            defaultValue={defaultLabel}
            required
            maxLength={60}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="effectiveDate">Effective date (optional)</Label>
          <Input id="effectiveDate" name="effectiveDate" type="date" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="changeSummary">Change summary (optional)</Label>
        <Textarea
          id="changeSummary"
          name="changeSummary"
          rows={2}
          maxLength={2000}
          placeholder="What changed in this version, in your own words."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="content">Policy text</Label>
        <Textarea
          id="content"
          name="content"
          rows={18}
          required
          minLength={20}
          className="font-mono text-xs"
          placeholder={"1. Purpose\nThis policy ...\n\n2. Scope\n..."}
        />
      </div>
    </>
  );
}
