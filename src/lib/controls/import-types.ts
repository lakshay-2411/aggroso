import type { ActionState } from "@/lib/action-state";

export interface ImportResult extends ActionState {
  created: number;
  updated: number;
  evidenceAdded: number;
  skipped: { row: number; reason: string }[];
}

export const initialImportResult: ImportResult = {
  error: null,
  success: null,
  created: 0,
  updated: 0,
  evidenceAdded: 0,
  skipped: [],
};
