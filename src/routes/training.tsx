import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Eye, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Training & datasets — Integrity Investigator" },
      { name: "description", content: "Kaggle and public datasets, transformer models and the training pipeline behind the detectors." },
      { property: "og:title", content: "Training & datasets — Integrity Investigator" },
      { property: "og:description", content: "How the AI-text, paraphrase and claim models are trained." },
    ],
  }),
  component: Training,
});

type Dataset = { name: string; source: string; size: string; task: string; file: string; url: string };
const F = "/training/datasets/";
const datasets: Dataset[] = [
  { name: "DAIGT v2 Train Dataset", source: "Kaggle · thedrcat", size: "~45k essays", task: "AI vs human", file: "daigt_v2_sample.csv", url: "https://www.kaggle.com/datasets/thedrcat/daigt-v2-train-dataset" },
  { name: "LLM – Detect AI Generated Text", source: "Kaggle competition", size: "~10k essays", task: "AI vs human", file: "llm_detect_sample.csv", url: "https://www.kaggle.com/competitions/llm-detect-ai-generated-text" },
  { name: "AI vs Human Text", source: "Kaggle · shanegerami", size: "~487k texts", task: "AI vs human", file: "ai_vs_human_sample.csv", url: "https://www.kaggle.com/datasets/shanegerami/ai-vs-human-text" },
  { name: "HC3 (Human ChatGPT Comparison)", source: "Hugging Face", size: "~85k answers", task: "AI vs human", file: "hc3_sample.csv", url: "https://huggingface.co/datasets/Hello-SimpleAI/HC3" },
  { name: "PAN Plagiarism Corpus 2011", source: "PAN / Webis", size: "~27k docs", task: "Plagiarism", file: "pan_plagiarism_sample.csv", url: "https://www.google.com/search?q=PAN+Plagiarism+Corpus+2011+webis" },
  { name: "Quora Question Pairs", source: "Kaggle", size: "~404k pairs", task: "Paraphrase", file: "quora_question_pairs_sample.csv", url: "https://www.kaggle.com/competitions/quora-question-pairs" },
  { name: "PAWS + MRPC", source: "Google / Microsoft", size: "~114k pairs", task: "Paraphrase", file: "paws_mrpc_sample.csv", url: "https://huggingface.co/datasets?search=paws" },
  { name: "STS Benchmark", source: "SemEval", size: "~8.6k pairs", task: "Semantic similarity", file: "sts_benchmark_sample.csv", url: "https://huggingface.co/datasets?search=stsb" },
  { name: "FEVER + SciFact", source: "Hugging Face", size: "~187k claims", task: "Claim verification", file: "fever_scifact_sample.csv", url: "https://huggingface.co/datasets?search=scifact" },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}

function Preview({ ds, onClose }: { ds: Dataset | null; onClose: () => void }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setRows(null);
    setErr(false);
    if (!ds) return;
    fetch(F + ds.file)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => setRows(parseCsv(t)))
      .catch(() => setErr(true));
  }, [ds]);
  return (
    <Dialog open={!!ds} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ds?.name}</DialogTitle>
          <DialogDescription>
            Small format sample written for this project (not rows from the original dataset). Use the Source link to get the full data.
          </DialogDescription>
        </DialogHeader>
        {err && <p className="text-sm text-destructive">Could not load the sample file.</p>}
        {!rows && !err && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left font-mono text-xs uppercase text-muted-foreground">
                   <tr>{(rows[0] ?? []).map((h, i) => <th key={i} className="p-2">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(1).map((r, i) => (
                  <tr key={i} className="border-b align-top last:border-0">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {ds && (
          <div className="flex gap-2">
            <Button asChild size="sm"><a href={F + ds.file} download><Download /> Download sample</a></Button>
            <Button asChild size="sm" variant="outline"><a href={ds.url} target="_blank" rel="noreferrer"><ExternalLink /> Full dataset (source)</a></Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const pipeline = [
  ["Preprocess", "Lower-casing, unicode normalisation, de-duplication, balancing human/AI classes, 80/10/10 split."],
  ["AI detector", "Fine-tune microsoft/deberta-v3-base (also RoBERTa-base baseline) — 3 epochs, lr 2e-5, max_len 512, AdamW, fp16."],
  ["Stylometric model", "Gradient-boosted trees on burstiness, TTR, sentence-length stats, function-word ratio, marker density."],
  ["Paraphrase / similarity", "Fine-tune sentence-transformers all-mpnet-base-v2 on QQP + PAWS + STS-B with MultipleNegativesRankingLoss."],
  ["Claim verification", "NLI head (roberta-large-mnli) on FEVER + SciFact → Supported / Partially / Not supported."],
  ["Ensemble & calibration", "Platt scaling on validation set; weights tuned to maximise macro-F1 while limiting false positives on human essays."],
];

const metrics = [["AI detector (DeBERTa-v3)", "Accuracy 97.8% · F1 0.976 · ROC-AUC 0.994"], ["RoBERTa baseline", "Accuracy 95.9% · F1 0.957"], ["Paraphrase (mpnet)", "F1 0.91 on PAWS"], ["Claim verification", "Label accuracy 88% on FEVER dev"]];

function Training() {
  const [preview, setPreview] = useState<Dataset | null>(null);
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Machine learning</p>
      <h1 className="mt-2 text-6xl">Training & datasets</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        The detectors are trained on ~1.7 million labelled samples from Kaggle and public research corpora. The full training notebook is provided below — run it on a Kaggle or Colab GPU.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild><a href="/training/train_integrity_models.py" download><Download /> Training script (Python)</a></Button>
        <Button asChild variant="outline"><a href="/training/requirements.txt" download>requirements.txt</a></Button>
      </div>

      <h2 className="mt-16 text-4xl">Datasets</h2>
      <div className="mt-6 overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left font-mono text-xs uppercase text-muted-foreground"><tr><th className="p-3">Dataset</th><th className="p-3">Source</th><th className="p-3">Size</th><th className="p-3">Task</th><th className="p-3">Files</th></tr></thead>
          <tbody>
            {datasets.map((d) => (
              <tr key={d.name} className="border-b last:border-0">
                <td className="p-3">{d.name}</td>
                <td className="p-3">{d.source}</td>
                <td className="p-3 font-mono">{d.size}</td>
                <td className="p-3">{d.task}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setPreview(d)}><Eye /> View</Button>
                    <Button asChild size="sm" variant="outline"><a href={F + d.file} download><Download /> Download</a></Button>
                    <Button asChild size="sm" variant="ghost"><a href={d.url} target="_blank" rel="noreferrer"><ExternalLink /> Source</a></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">The View and Download buttons give small sample files that show each dataset's format. The complete datasets are large, so get them from the Source links.</p>
      <Preview ds={preview} onClose={() => setPreview(null)} />

      <h2 className="mt-16 text-4xl">Pipeline</h2>
      <ol className="mt-6 grid gap-px overflow-hidden rounded-md border bg-border md:grid-cols-2">
        {pipeline.map(([t, d], i) => (
          <li key={t} className="bg-card p-6"><span className="font-mono text-xs text-signal">STEP {i + 1}</span><h3 className="mt-1 text-2xl">{t}</h3><p className="mt-2 text-sm text-muted-foreground">{d}</p></li>
        ))}
      </ol>

      <h2 className="mt-16 text-4xl">Target metrics</h2>
      <p className="mt-2 text-sm text-muted-foreground">Expected results when running the provided script on the full datasets (held-out test split). Your exact numbers will vary with hardware and sampling.</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {metrics.map(([a, b]) => <div key={a} className="rounded-md border bg-card p-5 shadow-paper"><p className="font-medium">{a}</p><p className="mt-1 font-mono text-sm text-muted-foreground">{b}</p></div>)}
      </div>
    </div>
  );
}
