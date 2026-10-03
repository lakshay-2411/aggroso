"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthFormState } from "@/lib/auth/actions";

type AuthAction = (
  prev: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

interface AuthFormProps {
  mode: "login" | "signup";
  action: AuthAction;
  nextPath?: string;
}

const copy = {
  login: {
    title: "Sign in",
    description: "Access your policy impact assessments.",
    submit: "Sign in",
    pending: "Signing in...",
    switchText: "No account yet?",
    switchLabel: "Create one",
    switchHref: "/signup",
  },
  signup: {
    title: "Create account",
    description: "Reviewers and owners use the same account type.",
    submit: "Create account",
    pending: "Creating account...",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/login",
  },
} as const;

export function AuthForm({ mode, action, nextPath }: AuthFormProps) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    action,
    { error: null },
  );
  const text = copy[mode];

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{text.title}</CardTitle>
        <CardDescription>{text.description}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

          {mode === "signup" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                autoComplete="name"
                required
                maxLength={120}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </div>

          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-6">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? text.pending : text.submit}
          </Button>
          <p className="text-sm text-muted-foreground">
            {text.switchText}{" "}
            <Link href={text.switchHref} className="underline underline-offset-4">
              {text.switchLabel}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
