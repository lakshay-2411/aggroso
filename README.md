# Aggroso

Policy Change Impact and Remediation Agent.

Aggroso assesses how a new policy version affects a bounded set of organizational controls, processes, or systems. It compares policy versions, maps changed requirements to controls, flags potentially outdated evidence, and keeps reviewers in charge of every decision.

The tool assesses only against the supplied policy and never claims formal compliance certification.

## Stack

- Next.js (App Router, TypeScript, Turbopack)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres + Auth)
- Google Gemini for the AI agent

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

## Database migrations

SQL migrations live in `supabase/migrations`. Apply each numbered file in order using the Supabase dashboard SQL editor.
