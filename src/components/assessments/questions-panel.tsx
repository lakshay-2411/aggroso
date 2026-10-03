"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { answerQuestion } from "@/lib/assessments/actions";
import type { ContextQuestionRow } from "@/lib/supabase/database.types";

interface QuestionsPanelProps {
  assessmentId: string;
  questions: ContextQuestionRow[];
  controlLabels: Map<string, string>;
  readOnly?: boolean;
}

function AnswerForm({ question, assessmentId }: { question: ContextQuestionRow; assessmentId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    answerQuestion,
    initialActionState,
  );
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="questionId" value={question.id} />
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <Label htmlFor={`answer-${question.id}`} className="sr-only">
        Answer
      </Label>
      <Textarea
        id={`answer-${question.id}`}
        name="answer"
        rows={2}
        required
        maxLength={4000}
        placeholder="Provide the missing context..."
      />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save answer"}
        </Button>
      </div>
    </form>
  );
}

export function QuestionsPanel({ assessmentId, questions, controlLabels, readOnly }: QuestionsPanelProps) {
  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          The agent did not need any additional context.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {questions.map((q) => (
        <Card key={q.id}>
          <CardHeader>
            <CardTitle className="text-base">{q.question}</CardTitle>
            {q.why_needed ? <CardDescription>Needed to decide: {q.why_needed}</CardDescription> : null}
            {q.related_control_ids.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Related controls:{" "}
                {q.related_control_ids.map((id) => controlLabels.get(id) ?? "unknown").join(", ")}
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            {q.answer ? (
              <p className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{q.answer}</p>
            ) : readOnly ? (
              <p className="text-sm text-muted-foreground italic">Unanswered.</p>
            ) : (
              <AnswerForm question={q} assessmentId={assessmentId} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
