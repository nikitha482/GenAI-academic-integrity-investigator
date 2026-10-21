import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText, NoObjectGeneratedError } from "ai";
import { z } from "zod";

const GATEWAY = "https://generativelanguage.googleapis.com/v1beta/openai";
const CHAT_MODEL = "gemini-3.1-flash-lite";
const EMBED_MODEL = "gemini-embedding-2";

export class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function apiKey() {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new GatewayError(401, "AI service is not configured.");
  return key;
}

export async function embed(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const key = apiKey();
  const out: number[][] = new Array(texts.length);
  const BATCH = 64;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(`${GATEWAY}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new GatewayError(res.status, safeMessage(res.status, body));
    }
    const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
    for (const d of json.data) out[i + d.index] = d.embedding;
  }
  return out;
}

function safeMessage(status: number, body: string) {
  try {
    const m = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message;
    if (m) return String(m);
  } catch {
    /* ignore */
  }
  if (status === 429) return "Too many requests right now. Please wait a moment and try again.";
  if (status === 402) return "AI credits are exhausted for this workspace.";
  return `AI service error (${status}).`;
}

const schema = z.object({
  ai_probability: z.number().describe("0-100 probability the text is AI-generated"),
  ai_summary: z.string(),
  sentences: z.array(
    z.object({
      text: z.string(),
      label: z.enum(["ai", "human", "mixed"]),
      confidence: z.number(),
    }),
  ),
  known_source_estimate: z.number().describe("0-100 estimate of text copied from well-known published sources"),
  known_source_notes: z.string(),
  citations: z.array(
    z.object({
      citation: z.string(),
      status: z.enum(["valid", "missing_reference", "inconsistent", "unverifiable", "fabricated"]),
      note: z.string(),
    }),
  ),
  claims: z.array(
    z.object({
      claim: z.string(),
      verdict: z.enum(["supported", "partially_supported", "not_supported"]),
      evidence: z.string(),
      source: z.string(),
    }),
  ),
  verdict: z.string(),
  recommendations: z.array(z.string()),
});

export type LlmAnalysis = z.infer<typeof schema>;

const INSTRUCTIONS = `You are a forensic academic-integrity examiner trained on AI-vs-human corpora (DAIGT, HC3, GPT-wiki-intro), plagiarism corpora (PAN), paraphrase corpora (PAWS, QQP, MRPC) and fact-verification corpora (FEVER, SciFact).
Analyse the submission carefully and return calibrated, evidence-based judgements.

AI detection: weigh perplexity-like predictability, low burstiness, generic hedging, formulaic transitions, list-like structure, lack of personal specifics or errors. Do NOT default to 50. Human student writing often has uneven rhythm, specific details, minor errors. Return up to 12 representative sentences copied verbatim with label and confidence 0-100.

Plagiarism (known sources): estimate what share appears copied from well-known published text (Wikipedia, textbooks, famous papers). Be conservative.

Citations: extract every in-text citation (e.g. (Smith, 2020), [3], et al.) and reference-list entry. Mark missing_reference if cited in text but absent from references; inconsistent if author/year mismatch; fabricated if the referenced work very likely does not exist; unverifiable if you cannot tell; valid otherwise. Empty array if none.

Claims / hallucinations: extract up to 10 factual, checkable claims (statistics, dates, findings, named facts). For each, verify against the provided reference documents first, then established knowledge. verdict: supported, partially_supported, or not_supported. Give short evidence and the source used ("Reference: <name>" or "General knowledge"). If the text contains no checkable factual claims, return an empty array.

verdict: a 2-3 sentence overall assessment for a teacher. recommendations: 3-5 actionable review steps. Remember AI detection is probabilistic, not proof.`;

export async function llmAnalyze(submission: string, references: { name: string; text: string }[]): Promise<LlmAnalysis> {
  const key = apiKey();
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey: key,
  });
  const refBlock = references.length
    ? references.map((r, i) => `### Reference ${i + 1}: ${r.name}\n${r.text.slice(0, 12000)}`).join("\n\n")
    : "(no reference documents provided)";

  let streamError: unknown;
  const result = streamText({
    model: provider.chat(CHAT_MODEL),
    instructions: INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: `## SUBMISSION\n${submission.slice(0, 40000)}\n\n## REFERENCE DOCUMENTS\n${refBlock}`,
      },
    ],
    output: Output.object({ schema }),
    maxRetries: 1,
    onError: ({ error }) => {
      streamError = error;
      console.error("[AI error]", error);
    },
  });
  try {
    return (await result.output) as LlmAnalysis;
  } catch (rawError) {
    const error = streamError ?? rawError;
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      try {
        return schema.parse(JSON.parse(error.text));
      } catch {
        /* fallthrough */
      }
    }
    const status = (error as { statusCode?: number })?.statusCode;
    if (status) throw new GatewayError(status, safeMessage(status, String((error as { responseBody?: string }).responseBody ?? "")));
    if (error instanceof Error && error !== rawError) throw new GatewayError(500, error.message);
    throw error;
  }
}