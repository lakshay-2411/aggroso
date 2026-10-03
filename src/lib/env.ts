function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Public values are safe in the browser. */
export const publicEnv = {
  get supabaseUrl() {
    return required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabasePublishableKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    );
  },
};

/** Server-only values. Never import this from a client component. */
export const serverEnv = {
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY);
  },
  get groqApiKey() {
    return required("GROQ_API_KEY", process.env.GROQ_API_KEY);
  },
  get groqModel() {
    return required("GROQ_MODEL", process.env.GROQ_MODEL);
  },
  /** Optional override of the Groq OpenAI-compatible base URL. */
  get groqBaseUrl() {
    return process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
  },
};
