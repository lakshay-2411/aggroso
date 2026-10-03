import type { Metadata } from "next";
import { PolicyForm } from "@/components/policies/policy-form";

export const metadata: Metadata = { title: "New policy" };

export default function NewPolicyPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New policy</h1>
        <p className="text-sm text-muted-foreground">
          Start with the version currently in force. You can add the new
          version afterwards and run an impact assessment between the two.
        </p>
      </div>
      <PolicyForm />
    </div>
  );
}
