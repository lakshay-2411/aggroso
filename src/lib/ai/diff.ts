/**
 * Deterministic paragraph-level diff between two policy texts.
 *
 * The model only sees the paragraphs that actually changed, plus the nearest
 * heading above each one for citation. This keeps prompts small and makes the
 * "what changed" step reproducible and auditable.
 */

export interface Paragraph {
  index: number;
  text: string;
  /** Nearest heading or numbered section line at or above this paragraph. */
  sectionRef: string | null;
}

export interface DiffHunk {
  /** Zero-based hunk number, stable for a given pair of texts. */
  index: number;
  removed: Paragraph[];
  added: Paragraph[];
}

const NUMBERED_PATTERN = /^(\d+(?:\.\d+)*)[.)]?\s+(\S.*)$/;
const MARKDOWN_HEADING_PATTERN = /^#{1,6}\s+(.+)$/;
const NAMED_SECTION_PATTERN = /^((?:section|article|part|appendix)\s+[\w.-]+)\b.*$/i;

/**
 * Derives a short section reference from a line, or null if the line does not
 * start a section. Numbered clauses such as "2.1 Passwords must..." yield just
 * the number, while short numbered headings keep their title.
 */
function sectionRefFor(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) return null;

  const md = MARKDOWN_HEADING_PATTERN.exec(trimmed);
  if (md) return md[1].trim().slice(0, 80);

  const numbered = NUMBERED_PATTERN.exec(trimmed);
  if (numbered) {
    const [, number, rest] = numbered;
    const isTitle = rest.length <= 50 && !/[.;:]$/.test(rest) && rest.split(/\s+/).length <= 7;
    return isTitle ? `${number} ${rest}` : number;
  }

  const named = NAMED_SECTION_PATTERN.exec(trimmed);
  if (named && trimmed.length <= 120) return named[1];

  return null;
}

/** Splits text into paragraphs, tracking the nearest section reference. */
export function splitParagraphs(text: string): Paragraph[] {
  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}|\n(?=\s*(?:\d+(?:\.\d+)*[.)]?\s|#{1,6}\s))/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const paragraphs: Paragraph[] = [];
  let currentRef: string | null = null;
  blocks.forEach((block, index) => {
    const firstLine = block.split("\n")[0] ?? block;
    const ref = sectionRefFor(firstLine);
    if (ref) currentRef = ref;
    paragraphs.push({ index, text: block, sectionRef: currentRef });
  });
  return paragraphs;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Longest-common-subsequence diff over normalized paragraphs. Adjacent
 * removed/added paragraphs are merged into one hunk so that a modified
 * paragraph appears as a pair.
 */
export function diffParagraphs(oldText: string, newText: string): DiffHunk[] {
  const a = splitParagraphs(oldText);
  const b = splitParagraphs(newText);
  const an = a.map((p) => normalize(p.text));
  const bn = b.map((p) => normalize(p.text));

  // LCS table
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = an[i] === bn[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  const flush = () => {
    if (current && (current.removed.length > 0 || current.added.length > 0)) {
      hunks.push(current);
    }
    current = null;
  };
  const ensure = (): DiffHunk => {
    if (!current) current = { index: hunks.length, removed: [], added: [] };
    return current;
  };

  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (an[i] === bn[j]) {
      flush();
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ensure().removed.push(a[i]);
      i++;
    } else {
      ensure().added.push(b[j]);
      j++;
    }
  }
  while (i < m) {
    ensure().removed.push(a[i]);
    i++;
  }
  while (j < n) {
    ensure().added.push(b[j]);
    j++;
  }
  flush();

  return hunks;
}

/** Renders hunks as compact text for the model. */
export function renderHunks(hunks: DiffHunk[]): string {
  return hunks
    .map((h) => {
      const removed =
        h.removed.length === 0
          ? "  (nothing removed)"
          : h.removed
              .map((p) => `  - [${p.sectionRef ?? "no section"}] ${p.text}`)
              .join("\n");
      const added =
        h.added.length === 0
          ? "  (nothing added)"
          : h.added.map((p) => `  + [${p.sectionRef ?? "no section"}] ${p.text}`).join("\n");
      return `## Hunk ${h.index}\nOLD:\n${removed}\nNEW:\n${added}`;
    })
    .join("\n\n");
}
