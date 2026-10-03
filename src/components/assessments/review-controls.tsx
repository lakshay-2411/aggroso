"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { reviewMapping } from "@/lib/assessments/review-actions";
import type { ImpactLevel, ReviewStatus } from "@/lib/supabase/database.types";

interface ReviewControlsProps {
  mappingId: string;
  assessmentId: string;
  reviewStatus: ReviewStatus;
  aiLevel: ImpactLevel;
  noActionRequired: boolean;
}

type Decision = "accept" | "reject" | "correct";

export function ReviewControls({
  mappingId,
  assessmentId,
  reviewStatus,
  aiLevel,
  noActionRequired,
}: ReviewControlsProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    reviewMapping,
    initialActionState,
  );
  const [decision, setDecision] = useState<Decision>("accept");
  const [editing, setEditing] = useState(reviewStatus === "pending");

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
          Change decision
        </Button>
        <form action={formAction}>
          <input type="hidden" name="mappingId" value={mappingId} />
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <input type="hidden" name="decision" value="reset" />
          <Button type="submit" variant="ghost" size="xs" disabled={pending}>
            Reset to pending
          </Button>
        </form>
        {state.error ? <span className="text-xs text-destructive">{state.error}</span> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t pt-3">
      <input type="hidden" name="mappingId" value={mappingId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr] sm:items-end">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`decision-${mappingId}`} className="text-xs">
            Decision
          </Label>
          <NativeSelect
            id={`decision-${mappingId}`}
            name="decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value as Decision)}
            className="w-44"
          >
            <option value="accept">Accept as proposed</option>
            <option value="correct">Correct impact level</option>
            <option value="reject">Reject mapping</option>
          </NativeSelect>
        </div>
        {decision === "correct" ? (
          <div className="flex flex-col gap-1">
            <Label htmlFor={`level-${mappingId}`} className="text-xs">
              Corrected level
            </Label>
            <NativeSelect
              id={`level-${mappingId}`}
              name="correctedLevel"
              defaultValue={aiLevel === "confirmed" ? "possible" : "confirmed"}
              className="w-36"
            >
              <option value="confirmed">Confirmed</option>
              <option value="possible">Possible</option>
            </NativeSelect>
          </div>
        ) : (
          <span />
        )}
        {decision !== "reject" ? (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="noActionRequired"
              defaultChecked={noActionRequired}
              className="size-3.5"
            />
            No action required (already satisfied)
          </label>
        ) : (
          <span />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`note-${mappingId}`} className="text-xs">
          Reviewer note {decision === "reject" ? "(required)" : "(optional)"}
        </Label>
        <Textarea
          id={`note-${mappingId}`}
          name="note"
          rows={2}
          maxLength={2000}
          required={decision === "reject"}
          placeholder={
            decision === "reject"
              ? "Why this control is not affected."
              : "Context for the audit trail."
          }
        />
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save decision"}
        </Button>
        {reviewStatus !== "pending" ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
