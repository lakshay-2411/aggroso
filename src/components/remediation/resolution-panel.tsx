"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionStatusBadge } from "@/components/remediation/action-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import {
  acceptRisk,
  createRemediationAction,
  revokeRiskAcceptance,
  updateRemediationAction,
} from "@/lib/remediation/actions";
import { ACTION_STATUSES, ACTION_STATUS_LABELS } from "@/lib/remediation/constants";
import type {
  ActionStatus,
  RemediationActionRow,
  RiskAcceptanceRow,
} from "@/lib/supabase/database.types";

export interface OwnerChoice {
  id: string;
  label: string;
}

interface ResolutionPanelProps {
  assessmentId: string;
  mappingId: string;
  suggestedRemediation: string | null;
  defaultOwnerId: string | null;
  defaultOwnerName: string | null;
  owners: OwnerChoice[];
  actions: RemediationActionRow[];
  acceptances: RiskAcceptanceRow[];
  ownerNames: Map<string, string>;
  resolved: boolean;
  noActionRequired: boolean;
  editable: boolean;
}

function OwnerFields({
  idPrefix,
  owners,
  ownerId,
  ownerName,
}: {
  idPrefix: string;
  owners: OwnerChoice[];
  ownerId: string | null;
  ownerName: string | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-owner`} className="text-xs">
          Owner (app user)
        </Label>
        <NativeSelect id={`${idPrefix}-owner`} name="ownerId" defaultValue={ownerId ?? ""}>
          <option value="">None</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-owner-name`} className="text-xs">
          Owner name (if not an app user)
        </Label>
        <Input
          id={`${idPrefix}-owner-name`}
          name="ownerName"
          defaultValue={ownerName ?? ""}
          maxLength={120}
        />
      </div>
    </div>
  );
}

function ActionRow({
  action,
  assessmentId,
  owners,
  ownerNames,
  editable,
}: {
  action: RemediationActionRow;
  assessmentId: string;
  owners: OwnerChoice[];
  ownerNames: Map<string, string>;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateRemediationAction,
    initialActionState,
  );
  const [editing, setEditing] = useState(false);
  const owner =
    (action.owner_id ? ownerNames.get(action.owner_id) : null) ?? action.owner_name ?? "Unassigned";

  return (
    <li className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ActionStatusBadge status={action.status} />
        <span className="text-sm font-medium">{action.title}</span>
        <span className="text-xs text-muted-foreground">
          Owner: {owner}
          {action.due_date ? ` · Due ${formatDate(action.due_date)}` : ""}
          {action.completed_at ? ` · Completed ${formatDate(action.completed_at.slice(0, 10))}` : ""}
        </span>
        {editable ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="ml-auto"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Close" : "Update"}
          </Button>
        ) : null}
      </div>
      {action.description ? (
        <p className="text-sm text-muted-foreground">{action.description}</p>
      ) : null}
      {editing ? (
        <form action={formAction} className="flex flex-col gap-3 border-t pt-3">
          <input type="hidden" name="actionId" value={action.id} />
          <input type="hidden" name="assessmentId" value={assessmentId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`status-${action.id}`} className="text-xs">
                Status
              </Label>
              <NativeSelect id={`status-${action.id}`} name="status" defaultValue={action.status}>
                {ACTION_STATUSES.map((s: ActionStatus) => (
                  <option key={s} value={s}>
                    {ACTION_STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`due-${action.id}`} className="text-xs">
                Due date
              </Label>
              <Input id={`due-${action.id}`} name="dueDate" type="date" defaultValue={action.due_date ?? ""} />
            </div>
          </div>
          <OwnerFields
            idPrefix={`act-${action.id}`}
            owners={owners}
            ownerId={action.owner_id}
            ownerName={action.owner_name}
          />
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

function NewActionForm({
  assessmentId,
  mappingId,
  suggestedRemediation,
  defaultOwnerId,
  defaultOwnerName,
  owners,
}: Pick<
  ResolutionPanelProps,
  "assessmentId" | "mappingId" | "suggestedRemediation" | "defaultOwnerId" | "defaultOwnerName" | "owners"
>) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createRemediationAction,
    initialActionState,
  );
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  if (!open) {
    return (
      <Button type="button" variant="outline" size="xs" onClick={() => setOpen(true)}>
        Create remediation action
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 rounded-md border p-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="mappingId" value={mappingId} />
      <div className="flex flex-col gap-1">
        <Label htmlFor={`title-${mappingId}`} className="text-xs">
          Action
        </Label>
        <Input
          id={`title-${mappingId}`}
          name="title"
          required
          maxLength={300}
          defaultValue={suggestedRemediation ?? ""}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`desc-${mappingId}`} className="text-xs">
          Details (optional)
        </Label>
        <Textarea id={`desc-${mappingId}`} name="description" rows={2} maxLength={4000} />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <OwnerFields
          idPrefix={`new-${mappingId}`}
          owners={owners}
          ownerId={defaultOwnerId}
          ownerName={defaultOwnerName}
        />
        <div className="flex flex-col gap-1">
          <Label htmlFor={`due-new-${mappingId}`} className="text-xs">
            Due date
          </Label>
          <Input id={`due-new-${mappingId}`} name="dueDate" type="date" />
        </div>
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? <p className="text-xs text-muted-foreground">{state.success}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating..." : "Create action"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}

function RiskAcceptanceBlock({
  assessmentId,
  mappingId,
  acceptances,
  ownerNames,
  editable,
}: Pick<ResolutionPanelProps, "assessmentId" | "mappingId" | "acceptances" | "ownerNames" | "editable">) {
  const [acceptState, acceptAction, acceptPending] = useActionState<ActionState, FormData>(
    acceptRisk,
    initialActionState,
  );
  const [revokeState, revokeAction, revokePending] = useActionState<ActionState, FormData>(
    revokeRiskAcceptance,
    initialActionState,
  );
  const [open, setOpen] = useState(false);
  const active = acceptances.find((a) => !a.revoked_at) ?? null;
  const history = acceptances.filter((a) => a.revoked_at);

  return (
    <div className="flex flex-col gap-2">
      {active ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
              Risk accepted
            </Badge>
            <span className="text-xs text-muted-foreground">
              By {(active.accepted_by && ownerNames.get(active.accepted_by)) || "unknown"} on{" "}
              {formatDate(active.created_at.slice(0, 10))} · Review by {formatDate(active.review_date)}
            </span>
          </div>
          <p className="text-sm">{active.reason}</p>
          {editable ? (
            <form action={revokeAction} className="flex flex-col gap-2 border-t pt-2">
              <input type="hidden" name="acceptanceId" value={active.id} />
              <input type="hidden" name="assessmentId" value={assessmentId} />
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex min-w-60 flex-1 flex-col gap-1">
                  <Label htmlFor={`revoke-${active.id}`} className="text-xs">
                    Revoke reason
                  </Label>
                  <Input id={`revoke-${active.id}`} name="reason" required maxLength={2000} />
                </div>
                <Button type="submit" variant="outline" size="sm" disabled={revokePending}>
                  {revokePending ? "Revoking..." : "Revoke"}
                </Button>
              </div>
              {revokeState.error ? (
                <span className="text-xs text-destructive">{revokeState.error}</span>
              ) : null}
            </form>
          ) : null}
        </div>
      ) : editable ? (
        open ? (
          <form action={acceptAction} className="flex flex-col gap-3 rounded-md border p-3">
            <input type="hidden" name="assessmentId" value={assessmentId} />
            <input type="hidden" name="mappingId" value={mappingId} />
            <p className="text-sm font-medium">Formal risk acceptance</p>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`reason-${mappingId}`} className="text-xs">
                Reason
              </Label>
              <Textarea
                id={`reason-${mappingId}`}
                name="reason"
                rows={3}
                required
                minLength={10}
                maxLength={4000}
                placeholder="Why the organisation accepts this impact without remediating it, and any compensating measures."
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`review-${mappingId}`} className="text-xs">
                Review date
              </Label>
              <Input id={`review-${mappingId}`} name="reviewDate" type="date" required className="w-48" />
            </div>
            {acceptState.error ? (
              <Alert variant="destructive">
                <AlertDescription>{acceptState.error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={acceptPending}>
                {acceptPending ? "Recording..." : "Accept risk"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="outline" size="xs" onClick={() => setOpen(true)}>
            Accept risk instead
          </Button>
        )
      ) : null}
      {history.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {history.length} revoked risk acceptance{history.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {history.map((h) => (
              <li key={h.id}>
                Accepted {formatDate(h.created_at.slice(0, 10))}, revoked{" "}
                {formatDate(h.revoked_at?.slice(0, 10))}: {h.revoke_reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/**
 * Remediation and risk acceptance for one accepted mapping. Shown under the
 * mapping once a reviewer has accepted or corrected it.
 */
export function ResolutionPanel(props: ResolutionPanelProps) {
  const { actions, acceptances, resolved, noActionRequired, editable } = props;
  const activeActions = actions.filter((a) => a.status !== "cancelled");
  const cancelled = actions.filter((a) => a.status === "cancelled");

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase">Resolution</span>
        {resolved ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
            Resolved
          </Badge>
        ) : (
          <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">
            Unresolved
          </Badge>
        )}
        {noActionRequired ? (
          <span className="text-xs text-muted-foreground">Reviewer marked no action required.</span>
        ) : null}
      </div>

      {activeActions.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {activeActions.map((a) => (
            <ActionRow
              key={a.id}
              action={a}
              assessmentId={props.assessmentId}
              owners={props.owners}
              ownerNames={props.ownerNames}
              editable={editable}
            />
          ))}
        </ul>
      ) : null}
      {cancelled.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {cancelled.length} cancelled action{cancelled.length === 1 ? "" : "s"}
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {cancelled.map((a) => (
              <li key={a.id} className="line-through">
                {a.title}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {editable ? (
        <div className="flex flex-wrap gap-2">
          <NewActionForm
            assessmentId={props.assessmentId}
            mappingId={props.mappingId}
            suggestedRemediation={props.suggestedRemediation}
            defaultOwnerId={props.defaultOwnerId}
            defaultOwnerName={props.defaultOwnerName}
            owners={props.owners}
          />
        </div>
      ) : null}

      <RiskAcceptanceBlock
        assessmentId={props.assessmentId}
        mappingId={props.mappingId}
        acceptances={acceptances}
        ownerNames={props.ownerNames}
        editable={editable}
      />
    </div>
  );
}
