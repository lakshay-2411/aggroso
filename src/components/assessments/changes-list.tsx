import { ChangeTypeBadge } from "@/components/assessments/badges";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RequirementChangeRow } from "@/lib/supabase/database.types";

interface ChangesListProps {
  changes: RequirementChangeRow[];
  mappedChangeIds: Set<string>;
  fromLabel: string;
  toLabel: string;
}

function Citation({
  heading,
  sectionRef,
  text,
  emptyLabel,
}: {
  heading: string;
  sectionRef: string | null;
  text: string | null;
  emptyLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium text-muted-foreground">
        {heading}
        {sectionRef ? <span className="ml-1 font-mono">§ {sectionRef}</span> : null}
      </p>
      {text ? (
        <blockquote className="text-sm whitespace-pre-wrap">“{text}”</blockquote>
      ) : (
        <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>
      )}
    </div>
  );
}

export function ChangesList({ changes, mappedChangeIds, fromLabel, toLabel }: ChangesListProps) {
  if (changes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No substantive requirement changes were found between the two versions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {changes.map((change) => {
        const mapped = mappedChangeIds.has(change.id);
        return (
          <Card key={change.id} id={`change-${change.id}`}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  C{change.position + 1}
                </span>
                <ChangeTypeBadge type={change.change_type} />
                {change.citation_verified ? (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                    Citation verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                    Citation not found verbatim
                  </Badge>
                )}
                {!mapped ? <Badge variant="outline">Unmapped</Badge> : null}
              </div>
              <CardTitle className="text-base">{change.title}</CardTitle>
              <CardDescription>{change.summary}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Citation
                  heading={`Old · ${fromLabel}`}
                  sectionRef={change.old_section_ref}
                  text={change.old_text}
                  emptyLabel="Not present in the previous version."
                />
                <Citation
                  heading={`New · ${toLabel}`}
                  sectionRef={change.new_section_ref}
                  text={change.new_text}
                  emptyLabel="Removed in the new version."
                />
              </div>
              {change.rationale ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why this is a change: </span>
                  {change.rationale}
                </p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
