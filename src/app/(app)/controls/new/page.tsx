import type { Metadata } from "next";
import Link from "next/link";
import { ControlForm } from "@/components/controls/control-form";
import { Card, CardContent } from "@/components/ui/card";
import { listOwners } from "@/lib/controls/queries";

export const metadata: Metadata = { title: "New control" };

export default async function NewControlPage() {
  const owners = await listOwners();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/controls"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Control register
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New control</h1>
      </div>
      <Card>
        <CardContent className="pt-6">
          <ControlForm owners={owners} />
        </CardContent>
      </Card>
    </div>
  );
}
