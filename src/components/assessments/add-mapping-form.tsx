"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { addManualMapping } from "@/lib/assessments/review-actions";

interface AddMappingFormProps {
  assessmentId: string;
  changes: { id: string; label: string }[];
  controls: { id: string; label: string }[];
}

export function AddMappingForm({ assessmentId, changes, controls }: AddMappingFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addManualMapping,
    initialActionState,
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  if (changes.length === 0 || controls.length === 0) return null;

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Add a mapping the agent missed
        </Button>
        {state.success ? <span className="text-sm text-muted-foreground">{state.success}</span> : null}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add mapping</CardTitle>
        <CardDescription>
          Link a change to a control manually. It is recorded as a reviewer
          decision and counts as accepted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-change">Changed requirement</Label>
              <NativeSelect id="add-change" name="changeId" required>
                {changes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-control">Control</Label>
              <NativeSelect id="add-control" name="controlId" required>
                {controls.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-level">Impact level</Label>
              <NativeSelect id="add-level" name="level" defaultValue="possible" className="w-40">
                <option value="confirmed">Confirmed</option>
                <option value="possible">Possible</option>
              </NativeSelect>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="evidenceOutdated" className="size-3.5" />
              Existing evidence is likely outdated
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-rationale">Why this control is affected</Label>
            <Textarea id="add-rationale" name="rationale" rows={2} required maxLength={2000} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-remediation">Suggested remediation (optional)</Label>
            <Textarea id="add-remediation" name="suggestedRemediation" rows={2} maxLength={2000} />
          </div>
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state.success ? (
            <p className="text-sm text-muted-foreground">{state.success} Add another or close.</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding..." : "Add mapping"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
