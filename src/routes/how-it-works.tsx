import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How it works — Integrity Investigator" },
      { name: "description", content: "System architecture: upload, preprocessing, detection modules and report generation." },
      { property: "og:title", content: "How it works — Integrity Investigator" },
      { property: "og:description", content: "Architecture of the GenAI academic integrity system." },
    ],
  }),
  component: How,
});

const steps = [
  ["Upload & preprocess", "PDF, DOCX or TXT is parsed in the browser, cleaned and split into sentences and chunks."],
  ["Parallel analysis", "Stylometry, n-gram fingerprinting, sentence embeddings and the GenAI transformer examiner run in parallel."],
  ["Cross-checking", "Sentences are matched to reference chunks; claims and citations are verified against references."],
  ["Scoring", "Signals are combined into AI %, Human %, Plagiarism %, Semantic %, Paraphrase % and an Integrity score."],
  ["Report", "An evidence-based report is saved to your account and can be printed as PDF."],
];

function How() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <h1 className="text-6xl">How it works</h1>
      <ol className="relative mt-12 space-y-10 border-l pl-8">
        {steps.map(([t, d], i) => (
          <li key={t} className="relative">
            <span className="absolute -left-[45px] grid h-7 w-7 place-items-center rounded-full bg-ink-gradient font-mono text-xs text-primary-foreground">{i + 1}</span>
            <h2 className="text-3xl">{t}</h2>
            <p className="mt-1 text-muted-foreground">{d}</p>
          </li>
        ))}
      </ol>
      <div className="mt-16 rounded-md border bg-card p-6 text-sm">
        <p className="font-medium">Tech stack</p>
        <p className="mt-2 text-muted-foreground">React + TanStack Start front-end · serverless analysis functions · Postgres database with row-level security · transformer GenAI model and embedding model via API · Python/PyTorch/Hugging Face training pipeline.</p>
      </div>
    </div>
  );
}
