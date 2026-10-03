"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { createControl, updateControl } from "@/lib/controls/actions";
import {
  REMEDIATION_STATUSES,
  REMEDIATION_STATUS_LABELS,
} from "@/lib/controls/constants";
import type { OwnerOption } from "@/lib/controls/queries";
import type { ControlRow } from "@/lib/supabase/database.types";

interface ControlFormProps {
  owners: OwnerOption[];
  control?: ControlRow;
}

export function ControlForm({ owners, control }: ControlFormProps) {
  const isEdit = Boolean(control);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    isEdit ? updateControl : createControl,
    initialActionState,
  );

  // Controlled values so that a re-render after saving does not change the
  // default of a mounted input.
  const [values, setValues] = useState({
    controlRef: control?.control_ref ?? "",
    title: control?.title ?? "",
    description: control?.description ?? "",
    category: control?.category ?? "",
    ownerId: control?.owner_id ?? "",
    ownerName: control?.owner_name ?? "",
    remediationStatus: control?.remediation_status ?? "not_started",
    remediationNotes: control?.remediation_notes ?? "",
  });

  function set<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {control ? <input type="hidden" name="controlId" value={control.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="controlRef">Reference</Label>
          <Input
            id="controlRef"
            name="controlRef"
            placeholder="e.g. AC-01"
            value={values.controlRef}
            onChange={(e) => set("controlRef", e.target.value)}
            required
            maxLength={60}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            value={values.title}
            onChange={(e) => set("title", e.target.value)}
            required
            maxLength={200}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          maxLength={4000}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What the control does and how it is operated."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="category">Category (optional)</Label>
          <Input
            id="category"
            name="category"
            placeholder="e.g. Access control"
            value={values.category}
            onChange={(e) => set("category", e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="remediationStatus">Remediation status</Label>
          <NativeSelect
            id="remediationStatus"
            name="remediationStatus"
            value={values.remediationStatus}
            onChange={(e) =>
              set("remediationStatus", e.target.value as typeof values.remediationStatus)
            }
          >
            {REMEDIATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {REMEDIATION_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ownerId">Owner (app user)</Label>
          <NativeSelect
            id="ownerId"
            name="ownerId"
            value={values.ownerId}
            onChange={(e) => set("ownerId", e.target.value)}
          >
            <option value="">Unassigned</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.full_name ? `${owner.full_name} (${owner.email})` : owner.email}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ownerName">Owner name (if not an app user)</Label>
          <Input
            id="ownerName"
            name="ownerName"
            placeholder="e.g. Head of IT"
            value={values.ownerName}
            onChange={(e) => set("ownerName", e.target.value)}
            maxLength={120}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="remediationNotes">Remediation notes (optional)</Label>
        <Textarea
          id="remediationNotes"
          name="remediationNotes"
          rows={2}
          maxLength={4000}
          value={values.remediationNotes}
          onChange={(e) => set("remediationNotes", e.target.value)}
        />
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <p className="text-sm text-muted-foreground">{state.success}</p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : isEdit ? "Save control" : "Create control"}
        </Button>
      </div>
    </form>
  );
}
