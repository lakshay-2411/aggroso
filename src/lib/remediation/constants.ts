import type { ActionStatus } from "@/lib/supabase/database.types";

export const ACTION_STATUSES: readonly ActionStatus[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
] as const;

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};
