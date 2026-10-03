# Aggroso

Policy Change Impact and Remediation Agent.

Aggroso assesses how a new policy version affects a bounded set of organizational controls, processes, or systems. It compares policy versions, maps changed requirements to controls, flags potentially outdated evidence, and keeps reviewers in charge of every decision.

The tool assesses only against the supplied policy and never claims formal compliance certification.

## Stack

- Next.js (App Router, TypeScript, Turbopack)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth)
- Groq (OpenAI-compatible API, free tier) for the AI agent

## Getting started

1. Copy `.env.example` to `.env.local` and fill in the values.
2. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

3. Open http://localhost:3000.

## Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build (also type-checks)
npm run lint    # run ESLint
```

## What it does

1. **Policies** – keep every version of a policy; versions are immutable.
2. **Control register** – controls with owners, evidence, and remediation status; CSV import.
3. **Assessments** – a deterministic paragraph diff finds what changed, then the AI model extracts changed requirements with verbatim citations (verified against the stored text), maps them to controls as *confirmed* or *possible* impact, flags potentially outdated evidence, suggests remediation, and asks for missing context.
4. **Review** – reviewers accept, reject, or correct each mapping, or add ones the agent missed. Counts (mapped, unmapped, compliant, unresolved) are computed from reviewer decisions only.
5. **Remediation** – actions with an owner, status, and due date; formal risk acceptance with a reason and review date.
6. **Staleness and re-evaluation** – assessments are flagged when the policy or a control changes; re-evaluation creates a new version and carries forward unaffected decisions.
7. **Audit history** – an append-only log of every decision and change, viewable globally and per record.
8. **Impact report** – a printable report (browser print to PDF) of the reviewed assessment.

Environment variables are listed in `.env.example`.

## Database migrations

SQL migrations live in `supabase/migrations`. Apply each numbered file in order (0001 to 0007) using the Supabase dashboard SQL editor.
