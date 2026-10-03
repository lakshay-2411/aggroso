"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { runAnalysis } from "@/lib/assessments/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Analyzing... this can take a minute or two on the free tier" : label}
    </Button>
  );
}

export function RunAnalysisButton({
  assessmentId,
  label,
}: {
  assessmentId: string;
  label: string;
}) {
  return (
    <form action={runAnalysis}>
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <SubmitButton label={label} />
    </form>
  );
}
