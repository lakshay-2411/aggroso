import { Badge } from "@/components/ui/badge";
import { REMEDIATION_STATUS_LABELS } from "@/lib/controls/constants";
import type { RemediationStatus } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

const styles: Record<RemediationStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  remediated: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  risk_accepted: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  not_applicable: "bg-muted text-muted-foreground line-through",
};

export function RemediationStatusBadge({
  status,
  className,
}: {
  status: RemediationStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("border-transparent", styles[status], className)}>
      {REMEDIATION_STATUS_LABELS[status]}
    </Badge>
  );
}
