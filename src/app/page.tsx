import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const capabilities = [
  {
    title: "Extract changed requirements",
    description:
      "Compare two policy versions and surface every changed requirement with the exact old and new sections cited.",
  },
  {
    title: "Map impact to controls",
    description:
      "Link each change to the controls or processes it touches, separating confirmed impact from possible impact.",
  },
  {
    title: "Review and decide",
    description:
      "Accept, reject, or correct every mapping. Assign owners, track remediation, or formally accept risk.",
  },
  {
    title: "Stay current",
    description:
      "Versions are preserved, stale assessments are flagged, and every decision is recorded in an audit history.",
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-20">
        <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Policy Change Impact and Remediation Agent
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Understand what a policy change really affects.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Aggroso compares policy versions, maps the changes to your control
          register, flags outdated evidence, and keeps humans in charge of
          every decision. Assessments are made only against the policy you
          supply and never constitute formal compliance certification.
        </p>
        <div className="flex gap-3">
          <Button size="lg" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/signup" />}>
            Create account
          </Button>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 px-6 pb-20 sm:grid-cols-2">
        {capabilities.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </section>
    </main>
  );
}
