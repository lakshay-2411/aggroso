"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error: string | null;
}

const credentialsSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signUpSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(1, "Enter your name.").max(120),
});

function safeNextPath(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/dashboard";
  // Only allow same-origin relative paths.
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  await recordAudit({
    actorId: data.user.id,
    actorEmail: data.user.email ?? null,
    entityType: "auth",
    entityId: data.user.id,
    action: "signed_in",
  });

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) {
    return { error: error.message };
  }
  if (!data.session || !data.user) {
    return {
      error:
        "Account created but no session was returned. Check that email confirmation is disabled in Supabase, then sign in.",
    };
  }

  await recordAudit({
    actorId: data.user.id,
    actorEmail: data.user.email ?? null,
    entityType: "auth",
    entityId: data.user.id,
    action: "signed_up",
  });

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  if (user) {
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email ?? null,
      entityType: "auth",
      entityId: user.id,
      action: "signed_out",
    });
  }

  redirect("/login");
}
