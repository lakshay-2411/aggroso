import { Badge } from "@/components/ui/badge";
import type {
  AssessmentStatus,
  ChangeType,
  ImpactLevel,
  ReviewStatus,
} from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export const ASSESSMENT_STATUS_LABELS: Record<AssessmentStatus, string> = {
  draft: "Draft",
  analyzing: "Analyzing",
  in_review: "In review",
  completed: "Completed",
  failed: "Failed",
};

const assessmentStyles: Record<AssessmentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  analyzing: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  in_review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "bg-destructive/15 text-destructive",
};

export function AssessmentStatusBadge({ status }: { status: AssessmentStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", assessmentStyles[status])}>
      {ASSESSMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function StaleBadge() {
  return (
    <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
      Stale
    </Badge>
  );
}

const impactStyles: Record<ImpactLevel, string> = {
  confirmed: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  possible: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
};

export function ImpactBadge({ level }: { level: ImpactLevel }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", impactStyles[level])}>
      {level === "confirmed" ? "Confirmed impact" : "Possible impact"}
    </Badge>
  );
}

const changeStyles: Record<ChangeType, string> = {
  added: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  modified: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  removed: "bg-muted text-muted-foreground",
};

export function ChangeTypeBadge({ type }: { type: ChangeType }) {
  return (
    <Badge variant="outline" className={cn("border-transparent capitalize", changeStyles[type])}>
      {type}
    </Badge>
  );
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending review",
  accepted: "Accepted",
  rejected: "Rejected",
  corrected: "Corrected",
};

const reviewStyles: Record<ReviewStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  accepted: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-destructive/15 text-destructive",
  corrected: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", reviewStyles[status])}>
      {REVIEW_STATUS_LABELS[status]}
    </Badge>
  );
}
