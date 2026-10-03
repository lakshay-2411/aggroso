"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { completeAssessment, reopenAssessment } from "@/lib/assessments/review-actions";

function Submit({ label, pendingLabel, variant }: { label: string; pendingLabel: string; variant?: "outline" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? pendingLabel : label}
    </Button>
  );
}

export function CompleteAssessmentButton({
  assessmentId,
  pendingCount,
}: {
  assessmentId: string;
  pendingCount: number;
}) {
  if (pendingCount > 0) {
    return (
      <Button type="button" disabled title="Review every mapping first">
        Complete review ({pendingCount} pending)
      </Button>
    );
  }
  return (
    <form action={completeAssessment}>
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <Submit label="Complete review" pendingLabel="Completing..." />
    </form>
  );
}

export function ReopenAssessmentButton({ assessmentId }: { assessmentId: string }) {
  return (
    <form action={reopenAssessment}>
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <Submit label="Reopen review" pendingLabel="Reopening..." variant="outline" />
    </form>
  );
}
