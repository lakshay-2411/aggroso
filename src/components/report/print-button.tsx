"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { recordReportGenerated } from "@/lib/assessments/report-actions";

interface PrintButtonProps {
  assessmentId: string;
  status: string;
  counts: Record<string, number>;
}

export function PrintButton({ assessmentId, status, counts }: PrintButtonProps) {
  const [pending, startTransition] = useTransition();

  function handlePrint() {
    startTransition(async () => {
      try {
        await recordReportGenerated({ assessmentId, status, counts });
      } finally {
        window.print();
      }
    });
  }

  return (
    <Button type="button" onClick={handlePrint} disabled={pending} className="print:hidden">
      {pending ? "Preparing..." : "Print / Save as PDF"}
    </Button>
  );
}
