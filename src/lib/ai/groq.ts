import "server-only";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { serverEnv } from "@/lib/env";

/**
 * Groq exposes an OpenAI-compatible API, so the official OpenAI SDK is used
 * with the Groq base URL. The SDK retries 429 and 5xx responses with backoff
 * and honours Retry-After headers, which matters on the free tier.
 */
function getClient() {
  return new OpenAI({
    apiKey: serverEnv.groqApiKey,
    baseURL: serverEnv.groqBaseUrl,
    maxRetries: 5,
    timeout: 120_000,
  });
}

export interface StructuredCallOptions<T> {
  /** Zod schema for the expected JSON. Sent as a strict JSON schema. */
  schema: z.ZodType<T>;
  /** Short identifier for the schema: letters, digits, underscores. */
  schemaName: string;
  systemInstruction: string;
  prompt: string;
  /** Lower values make output more deterministic. */
  temperature?: number;
  /** Cap on output tokens, to stay inside per-minute token budgets. */
  maxOutputTokens?: number;
  /** Reasoning effort for reasoning models. Lower uses fewer tokens. */
  reasoningEffort?: "low" | "medium" | "high";
}

export interface StructuredCallResult<T> {
  data: T;
  model: string;
  usage: { promptTokens: number; outputTokens: number; totalTokens: number };
}

/** Rough token estimate used to keep prompts inside free-tier budgets. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calls the model with a strict JSON schema response format and validates the
 * reply with zod, so callers only ever see well-typed data.
 */
export async function generateStructured<T>(
  options: StructuredCallOptions<T>,
): Promise<StructuredCallResult<T>> {
  const client = getClient();
  const model = serverEnv.groqModel;

  const completion = await client.chat.completions.parse({
    model,
    temperature: options.temperature ?? 0.2,
    max_completion_tokens: options.maxOutputTokens,
    reasoning_effort: options.reasoningEffort,
    messages: [
      { role: "system", content: options.systemInstruction },
      { role: "user", content: options.prompt },
    ],
    response_format: zodResponseFormat(options.schema, options.schemaName),
  });

  const message = completion.choices[0]?.message;
  if (!message) {
    throw new Error("The model returned no choices.");
  }
  if (message.refusal) {
    throw new Error(`The model refused the request: ${message.refusal}`);
  }

  const validated = options.schema.safeParse(message.parsed ?? safeJson(message.content));
  if (!validated.success) {
    throw new Error(
      `Model output did not match the expected schema: ${validated.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  return {
    data: validated.data,
    model: completion.model || model,
    usage: {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      totalTokens: completion.usage?.total_tokens ?? 0,
    },
  };
}

function safeJson(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
