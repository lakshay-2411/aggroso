"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { updatePolicy } from "@/lib/policies/actions";

interface PolicyDetailsFormProps {
  policyId: string;
  title: string;
  description: string | null;
}

export function PolicyDetailsForm({
  policyId,
  title: initialTitle,
  description: initialDescription,
}: PolicyDetailsFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updatePolicy,
    initialActionState,
  );
  // Controlled so that a server re-render after saving does not change the
  // default value of a mounted input.
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="policyId" value={policyId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={200}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <p className="text-sm text-muted-foreground">{state.success}</p>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save details"}
        </Button>
      </div>
    </form>
  );
}
