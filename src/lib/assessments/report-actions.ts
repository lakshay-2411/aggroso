"use server";

import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

/** Records that a report was generated (printed or saved), for the audit trail. */
export async function recordReportGenerated(input: {
  assessmentId: string;
  status: string;
  counts: Record<string, number>;
}): Promise<void> {
  const parsed = z
    .object({
      assessmentId: z.uuid(),
      status: z.string().max(40),
      counts: z.record(z.string(), z.number()),
    })
    .safeParse(input);
  if (!parsed.success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email ?? null,
    entityType: "assessment",
    entityId: parsed.data.assessmentId,
    action: "report_generated",
    details: { status: parsed.data.status, counts: parsed.data.counts },
  });
}
