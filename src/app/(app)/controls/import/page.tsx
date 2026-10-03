import type { Metadata } from "next";
import Link from "next/link";
import { CsvImportForm } from "@/components/controls/csv-import-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CONTROL_CSV_COLUMNS,
  REMEDIATION_STATUSES,
} from "@/lib/controls/constants";

export const metadata: Metadata = { title: "Import controls" };

const columnHelp: Record<(typeof CONTROL_CSV_COLUMNS)[number], string> = {
  control_ref: "Required. Unique reference such as AC-01. Used to match existing controls.",
  title: "Required. Short name of the control.",
  description: "What the control does.",
  category: "Free-text grouping, e.g. Access control.",
  owner_email: "Email of an app user. Matched to a profile when it exists.",
  owner_name: "Fallback owner name when the owner is not an app user.",
  remediation_status: `One of: ${REMEDIATION_STATUSES.join(", ")}. Defaults to not_started.`,
  remediation_notes: "Current remediation notes.",
  evidence_title: "If present, one evidence row is added to the control.",
  evidence_description: "Details of the evidence.",
  evidence_date: "YYYY-MM-DD. When the evidence was produced.",
  evidence_reference: "Ticket, link, or storage location.",
};

export default function ImportControlsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/controls"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Control register
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Import controls from CSV</h1>
      </div>

      <CsvImportForm />

      <Card>
        <CardHeader>
          <CardTitle>Accepted columns</CardTitle>
          <CardDescription>
            Header names are case-insensitive. Extra columns are rejected so
            typos are caught early. To attach several pieces of evidence to one
            control, repeat the control on multiple rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
            {CONTROL_CSV_COLUMNS.map((column) => (
              <div key={column} className="contents">
                <dt className="font-mono text-xs">{column}</dt>
                <dd className="text-muted-foreground">{columnHelp[column]}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
