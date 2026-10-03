"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { importControlsCsv } from "@/lib/controls/actions";
import {
  initialImportResult,
  type ImportResult,
} from "@/lib/controls/import-types";

export function CsvImportForm() {
  const [state, formAction, pending] = useActionState<ImportResult, FormData>(
    importControlsCsv,
    initialImportResult,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={formAction}>
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV</CardTitle>
            <CardDescription>
              Rows are matched on <code>control_ref</code>. Existing controls are
              updated, new ones are created. Evidence columns add one evidence
              row per CSV line.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Label htmlFor="file">CSV file</Label>
            <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-3 pt-6">
            <Button type="submit" disabled={pending}>
              {pending ? "Importing..." : "Import"}
            </Button>
            <a
              href="/controls/import/template"
              className="text-sm underline underline-offset-4"
              download
            >
              Download template CSV
            </a>
          </CardFooter>
        </Card>
      </form>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.success ? (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>{state.success}</CardDescription>
          </CardHeader>
          {state.skipped.length > 0 ? (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Row</TableHead>
                    <TableHead>Reason skipped</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.skipped.map((item) => (
                    <TableRow key={`${item.row}-${item.reason}`}>
                      <TableCell className="tabular-nums">{item.row}</TableCell>
                      <TableCell>{item.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
