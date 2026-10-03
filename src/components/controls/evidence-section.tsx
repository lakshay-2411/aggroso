"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { addEvidence, removeEvidence } from "@/lib/controls/actions";
import { formatDate } from "@/lib/format";
import type { ControlEvidenceRow } from "@/lib/supabase/database.types";

interface EvidenceSectionProps {
  controlId: string;
  evidence: ControlEvidenceRow[];
}

export function EvidenceSection({ controlId, evidence }: EvidenceSectionProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addEvidence,
    initialActionState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence</CardTitle>
        <CardDescription>
          Artefacts that show this control operates. Dates matter: the agent
          uses them to flag evidence that may predate a policy change.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {evidence.length === 0 ? (
          <p className="text-sm text-muted-foreground">No evidence recorded yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evidence</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidence.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <p className="font-medium">{item.title}</p>
                    {item.description ? (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.evidence_date)}
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">
                    {item.reference ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={removeEvidence}>
                      <input type="hidden" name="evidenceId" value={item.id} />
                      <input type="hidden" name="controlId" value={controlId} />
                      <Button type="submit" variant="ghost" size="xs">
                        Remove
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <form ref={formRef} action={formAction} className="flex flex-col gap-4 border-t pt-6">
          <input type="hidden" name="controlId" value={controlId} />
          <p className="text-sm font-medium">Add evidence</p>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="evidence-title">Title</Label>
              <Input id="evidence-title" name="title" required maxLength={200} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="evidence-date">Evidence date</Label>
              <Input id="evidence-date" name="evidenceDate" type="date" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="evidence-reference">Reference or location (optional)</Label>
            <Input
              id="evidence-reference"
              name="reference"
              placeholder="Ticket number, document link, shared drive path"
              maxLength={1000}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="evidence-description">Description (optional)</Label>
            <Textarea id="evidence-description" name="description" rows={2} maxLength={4000} />
          </div>
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding..." : "Add evidence"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
