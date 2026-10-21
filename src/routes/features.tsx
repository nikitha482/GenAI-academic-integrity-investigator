import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — Integrity Investigator" },
      { name: "description", content: "AI detection, plagiarism, semantic similarity, paraphrase, citation and hallucination analysis explained." },
      { property: "og:title", content: "Features — Integrity Investigator" },
      { property: "og:description", content: "Every check in the academic integrity report." },
    ],
  }),
  component: Features,
});

const features = [
  ["AI vs human detection", "A weighted ensemble: 70% transformer classifier (fine-tuned DeBERTa-v3 approach served via GenAI), 30% stylometric model using burstiness, sentence-length variance, type-token ratio, AI-marker density and n-gram repetition. Output: AI % and Human %, plus sentence-level labels with confidence."],
  ["Plagiarism detection", "Word 5-gram shingling with containment and Jaccard scores against every reference. Longest matching runs are returned as quoted evidence. Without references, the system estimates overlap with well-known published sources."],
  ["Semantic similarity", "Each sentence is embedded with a multilingual embedding model and compared by cosine similarity to reference chunks. ≥ 0.82 counts as a semantic match."],
  ["Paraphrase detection", "A passage is flagged as paraphrased when meaning matches (semantic ≥ 0.82) but wording differs (lexical Jaccard < 0.45) — the gap traditional checkers miss."],
  ["Citation analysis", "In-text citations and the reference list are extracted and cross-checked: valid, missing reference, inconsistent, fabricated or unverifiable."],
  ["Hallucination / claim verification", "Checkable factual claims are verified against reference documents first, then established knowledge — labelled Supported, Partially supported or Not supported. If there are no claims, the report says “No claims”."],
  ["Integrity score", "100 − (0.35·AI + 0.35·Plagiarism + 0.15·Paraphrase + penalties for unsupported claims and bad citations)."],
  ["Evidence-based report", "Saved per user, printable to PDF, with verdict and reviewer recommendations."],
];

function Features() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Modules 2–4</p>
      <h1 className="mt-2 text-6xl">Features</h1>
      <div className="mt-12 divide-y border-y">
        {features.map(([t, d], i) => (
          <div key={t} className="grid gap-4 py-8 md:grid-cols-[80px_260px_1fr]">
            <span className="font-mono text-sm text-signal">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="text-3xl">{t}</h2>
            <p className="text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
