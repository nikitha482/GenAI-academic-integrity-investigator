import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, Copy, Quote, Shuffle, ShieldCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Integrity Investigator — AI, plagiarism & hallucination checker" },
      { name: "description", content: "One report for AI-vs-human detection, plagiarism, semantic similarity, paraphrasing, citations and hallucinated claims." },
      { property: "og:title", content: "Integrity Investigator — AI, plagiarism & hallucination checker" },
      { property: "og:description", content: "Evidence-based academic integrity reports powered by transformers and GenAI." },
    ],
  }),
  component: Index,
});

const checks = [
  { icon: Bot, title: "AI vs Human", text: "Ensemble of a transformer classifier and stylometric model, scored per sentence." },
  { icon: Copy, title: "Plagiarism", text: "Word 5-gram fingerprinting with exact matched passages as evidence." },
  { icon: Shuffle, title: "Semantic & paraphrase", text: "Embedding similarity catches rewritten text that keyword tools miss." },
  { icon: Quote, title: "Citations", text: "Finds missing, inconsistent or fabricated references." },
  { icon: ShieldCheck, title: "Hallucinations", text: "Each claim marked Supported, Partially supported or Not supported." },
  { icon: FileText, title: "Report", text: "A printable report teachers can review and keep." },
];

function Index() {
  return (
    <div>
      <section className="rule-grid border-b">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">GenAI · NLP · Transformers</p>
            <h1 className="mt-4 text-5xl leading-[1.05] md:text-7xl">
              Read every submission like an <em className="text-primary">investigator</em>.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              Upload an assignment and get one evidence-based report: AI-generated vs human content, plagiarism,
              semantic similarity, paraphrasing, citation problems and hallucinated claims — all in percentages.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/analyze">Analyze a submission <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/how-it-works">How it works</Link></Button>
            </div>
          </div>
          <img src={hero} width={1280} height={960} alt="Essay under a magnifying glass with highlighted sentences" className="rounded-md border shadow-paper" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-4xl">Six checks. One report.</h2>
        <div className="mt-10 grid gap-px overflow-hidden rounded-md border bg-border md:grid-cols-3">
          {checks.map((c) => (
            <div key={c.title} className="bg-card p-6">
              <c.icon className="h-5 w-5 text-signal" />
              <h3 className="mt-4 text-2xl">{c.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5">
        <div className="grid gap-8 rounded-md bg-ink-gradient p-10 text-primary-foreground md:grid-cols-3">
          {[["1.7M+", "training samples across 9 public datasets"], ["DeBERTa-v3", "fine-tuned AI-text classifier"], ["6", "integrity indicators per report"]].map(([a, b]) => (
            <div key={a}>
              <p className="font-display text-5xl">{a}</p>
              <p className="mt-2 text-sm opacity-80">{b}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
