"use client";

import { useFormStatus } from "react-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { reevaluateAssessment } from "@/lib/assessments/reevaluate";

interface StaleAlertProps {
  assessmentId: string;
  reasons: string[];
  /** Candidate starting versions for the re-evaluation, oldest first. */
  fromOptions: { id: string; label: string }[];
  defaultFromId: string;
  latestLabel: string;
  canReevaluate: boolean;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Re-evaluating... this runs the analysis again" : "Re-evaluate now"}
    </Button>
  );
}

export function StaleAlert({
  assessmentId,
  reasons,
  fromOptions,
  defaultFromId,
  latestLabel,
  canReevaluate,
}: StaleAlertProps) {
  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertTitle>This assessment is stale</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <ul className="list-disc pl-5">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {canReevaluate ? (
          <form action={reevaluateAssessment} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <div className="flex flex-col gap-1">
              <Label htmlFor="fromVersionId" className="text-xs">
                Compare from
              </Label>
              <NativeSelect id="fromVersionId" name="fromVersionId" defaultValue={defaultFromId} className="w-56">
                {fromOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <span className="pb-1.5 text-sm text-muted-foreground">to latest ({latestLabel})</span>
            <Submit />
            <p className="basis-full text-xs text-muted-foreground">
              Creates a new assessment version. Decisions, actions, and risk
              acceptances on items not affected by the change are carried
              forward; affected items come back for review.
            </p>
          </form>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
