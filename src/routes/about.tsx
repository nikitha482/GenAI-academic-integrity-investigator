import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About the project — Integrity Investigator" },
      { name: "description", content: "B.Tech IT major project at Bhoj Reddy Engineering College for Women, AY 2026-27." },
      { property: "og:title", content: "About the project — Integrity Investigator" },
      { property: "og:description", content: "Problem statement, objectives and team." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Major project · AY 2026-27</p>
      <h1 className="mt-2 text-6xl">GenAI Academic Integrity Investigator</h1>
      <div className="mt-10 space-y-8">
        <section><h2 className="text-3xl">Problem</h2><p className="mt-2 text-muted-foreground">Manual checking of assignments is slow, and traditional plagiarism tools miss paraphrased and AI-generated content. Institutions need an automated, evidence-based way to review submissions.</p></section>
        <section><h2 className="text-3xl">Objective</h2><p className="mt-2 text-muted-foreground">Build a GenAI and NLP system using transformers (BERT, RoBERTa, DeBERTa) that detects AI content, plagiarism, semantic similarity, paraphrasing, citation issues and hallucinations, and produces a report that helps teachers decide fairly.</p></section>
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-md border bg-card p-5"><p className="font-medium">Team</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground"><li>P. Navya — 23321A1255</li><li>L. Nikitha — 23321A1257</li><li>P. Pranitha — 23321A1264</li></ul></div>
          <div className="rounded-md border bg-card p-5"><p className="font-medium">Guidance</p><ul className="mt-2 space-y-1 text-sm text-muted-foreground"><li>Internal guide: M K Mehveen</li><li>Coordinator: Mr G Sudhakar Raju</li><li>HOD: Dr M Sandhya Rani</li></ul></div>
        </section>
        <p className="text-sm text-muted-foreground">Department of Information Technology, Bhoj Reddy Engineering College for Women, Hyderabad.</p>
      </div>
    </div>
  );
}
