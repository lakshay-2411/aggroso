import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ControlForm } from "@/components/controls/control-form";
import { EvidenceSection } from "@/components/controls/evidence-section";
import { RemediationStatusBadge } from "@/components/controls/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setControlActive } from "@/lib/controls/actions";
import { getControl, listOwners, ownerDisplayName } from "@/lib/controls/queries";
import { formatDateTime } from "@/lib/format";

type Props = PageProps<"/controls/[controlId]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { controlId } = await props.params;
  const control = await getControl(controlId);
  return { title: control ? `${control.control_ref} · ${control.title}` : "Control" };
}

export default async function ControlPage(props: Props) {
  const { controlId } = await props.params;
  const [control, owners] = await Promise.all([getControl(controlId), listOwners()]);
  if (!control) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <Link
            href="/controls"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Control register
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              <span className="font-mono text-muted-foreground">{control.control_ref}</span>{" "}
              {control.title}
            </h1>
            <RemediationStatusBadge status={control.remediation_status} />
            {!control.is_active ? <Badge variant="outline">Inactive</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Owner: {ownerDisplayName(control.owner, control.owner_name)} · Revision{" "}
            {control.revision} · Updated {formatDateTime(control.updated_at)}
          </p>
        </div>
        <form action={setControlActive}>
          <input type="hidden" name="controlId" value={control.id} />
          <input type="hidden" name="active" value={control.is_active ? "false" : "true"} />
          <Button type="submit" variant="outline" size="sm">
            {control.is_active ? "Deactivate" : "Reactivate"}
          </Button>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Control details</CardTitle>
            <CardDescription>
              Any change here increments the revision, which marks assessments
              that relied on the previous state as stale.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ControlForm owners={owners} control={control} />
          </CardContent>
        </Card>

        <EvidenceSection controlId={control.id} evidence={control.evidence} />
      </div>
    </div>
  );
}
