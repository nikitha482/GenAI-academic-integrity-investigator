import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkText, cosine, lexicalOverlap, lexicalSimilarity, splitSentences, stylometry } from "./text";
import type { AnalysisResult } from "./types";

const input = z.object({
  title: z.string().max(200),
  text: z.string().min(80, "Please provide at least a short paragraph (80+ characters).").max(120000),
  references: z.array(z.object({ name: z.string().max(200), text: z.string().max(120000) })).max(8),
});

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export const analyzeSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { llmAnalyze, embed, GatewayError } = await import("./ai.server");
    const refs = data.references.filter((r) => r.text.trim().length > 40);
    const style = stylometry(data.text);

    // 1) Lexical plagiarism vs references
    const lexical = refs.map((r) => lexicalOverlap(data.text, r.name, r.text));

    // 2) Semantic similarity + paraphrase via embeddings
    const subChunks = splitSentences(data.text).slice(0, 120);
    const refChunks: { source: string; text: string }[] = [];
    for (const r of refs) for (const c of chunkText(r.text, 35).slice(0, 60)) refChunks.push({ source: r.name, text: c });

    let semanticMatches: AnalysisResult["semantic"]["matches"] = [];
    let semanticScore = 0;
    let paraphraseScore = 0;

    try {
      const [llm, vectors] = await Promise.all([
        llmAnalyze(data.text, refs),
        refChunks.length && subChunks.length ? embed([...subChunks, ...refChunks.map((c) => c.text)]) : Promise.resolve([]),
      ]);

      if (vectors.length) {
        const sv = vectors.slice(0, subChunks.length);
        const rv = vectors.slice(subChunks.length);
        let semHits = 0, paraHits = 0;
        const all: AnalysisResult["semantic"]["matches"] = [];
        sv.forEach((v, i) => {
          let best = -1, bi = 0;
          rv.forEach((w, j) => {
            const c = cosine(v, w);
            if (c > best) { best = c; bi = j; }
          });
          const sentence = subChunks[i];
          const reference = refChunks[bi];
          if (sentence === undefined || reference === undefined || best < 0) {
            throw new Error("Similarity analysis returned incomplete reference matches. Please try again.");
          }
          const lex = lexicalSimilarity(sentence, reference.text);
          const semantic = best >= 0.82;
          const paraphrased = semantic && lex < 0.45;
          if (semantic) semHits++;
          if (paraphrased) paraHits++;
          all.push({ submission: sentence, reference: reference.text, source: reference.source, similarity: +best.toFixed(3), lexical: +lex.toFixed(3), paraphrased });
        });
        semanticScore = (semHits / sv.length) * 100;
        paraphraseScore = (paraHits / sv.length) * 100;
        semanticMatches = all.filter((m) => m.similarity >= 0.75).sort((a, b) => b.similarity - a.similarity).slice(0, 15);
      }

      const lexMax = lexical.reduce((m, l) => Math.max(m, l.containment * 100), 0);
      const plagiarism = refs.length ? Math.max(lexMax, semanticScore * 0.6) : llm.known_source_estimate;
      if (!refs.length) {
        semanticScore = llm.known_source_estimate * 0.9;
        paraphraseScore = Math.max(0, llm.known_source_estimate * 0.5);
      }

      const ai = clamp(0.7 * llm.ai_probability + 0.3 * style.aiLikelihood);
      const unsupported = llm.claims.filter((c) => c.verdict === "not_supported").length;
      const partial = llm.claims.filter((c) => c.verdict === "partially_supported").length;
      const badCites = llm.citations.filter((c) => c.status !== "valid" && c.status !== "unverifiable").length;
      const integrity = clamp(100 - (0.35 * ai + 0.35 * plagiarism + 0.15 * paraphraseScore + unsupported * 4 + partial * 1.5 + badCites * 3));

      const result: AnalysisResult = {
        title: data.title || "Untitled submission",
        wordCount: style.wordCount,
        scores: {
          ai,
          human: 100 - ai,
          plagiarism: clamp(plagiarism),
          semantic: clamp(semanticScore),
          paraphrase: clamp(paraphraseScore),
          integrity,
        },
        aiDetection: {
          modelScore: clamp(llm.ai_probability),
          stylometricScore: style.aiLikelihood,
          summary: llm.ai_summary,
          sentences: llm.sentences.map((s) => ({ ...s, confidence: clamp(s.confidence) })),
        },
        stylometry: style,
        plagiarism: {
          mode: refs.length ? "reference" : "estimated",
          sources: lexical.map((l) => ({ source: l.source, containment: +(l.containment * 100).toFixed(1), passages: l.passages })),
          knownSourceNotes: llm.known_source_notes,
        },
        semantic: { matches: semanticMatches },
        citations: { found: llm.citations.length, items: llm.citations },
        claims: { status: llm.claims.length ? "checked" : "no_claims", items: llm.claims },
        verdict: llm.verdict,
        recommendations: llm.recommendations,
        createdAt: new Date().toISOString(),
      };

      const { data: row, error } = await context.supabase
        .from("reports")
        .insert({
          user_id: context.userId,
          title: result.title,
          word_count: result.wordCount,
          ai_score: result.scores.ai,
          human_score: result.scores.human,
          plagiarism_score: result.scores.plagiarism,
          semantic_score: result.scores.semantic,
          paraphrase_score: result.scores.paraphrase,
          integrity_score: result.scores.integrity,
          result: result as never,
        })
        .select("id")
        .single();
      if (error) throw new Error("Could not save the report: " + error.message);
      return { id: row.id };
    } catch (e) {
      if (e instanceof GatewayError) throw new Error(e.message);
      throw e;
    }
  });
