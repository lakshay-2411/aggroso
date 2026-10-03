/** Shared return shape for form server actions used with useActionState. */
export interface ActionState {
  error: string | null;
  success?: string | null;
}

export const initialActionState: ActionState = { error: null, success: null };
