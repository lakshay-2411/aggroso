import { Badge } from "@/components/ui/badge";
import { ACTION_STATUS_LABELS } from "@/lib/remediation/constants";
import type { ActionStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const styles: Record<ActionStatus, string> = {
  open: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", styles[status])}>
      {ACTION_STATUS_LABELS[status]}
    </Badge>
  );
}
