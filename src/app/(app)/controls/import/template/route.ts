import { CONTROL_CSV_COLUMNS } from "@/lib/controls/constants";
import { toCsv } from "@/lib/csv";

/** Serves a CSV template with the accepted headers and two example rows. */
export async function GET() {
  const body = toCsv(
    [...CONTROL_CSV_COLUMNS],
    [
      [
        "AC-01",
        "User access reviews",
        "Quarterly review of user accounts against HR records.",
        "Access control",
        "owner@example.com",
        "",
        "in_progress",
        "Q3 review pending sign-off.",
        "Q2 access review report",
        "Signed review covering all production systems.",
        "2026-06-30",
        "SharePoint/Compliance/AccessReviews/2026-Q2.pdf",
      ],
      [
        "CR-04",
        "Encryption of laptops",
        "Full-disk encryption enforced via MDM.",
        "Data protection",
        "",
        "Head of IT",
        "remediated",
        "",
        "MDM compliance export",
        "",
        "2026-09-15",
        "JIRA-1234",
      ],
    ],
  );

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="controls-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}
