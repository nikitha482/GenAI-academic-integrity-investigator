import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { extractText } from "@/lib/extract";
import { analyzeSubmission } from "@/lib/analysis/analyze.functions";

export const Route = createFileRoute("/_authenticated/analyze")({
  head: () => ({
    meta: [
      { title: "Analyze a submission — Integrity Investigator" },
      { name: "description", content: "Upload a PDF, DOCX or text submission and reference sources for a full integrity analysis." },
      { property: "og:title", content: "Analyze a submission — Integrity Investigator" },
      { property: "og:description", content: "Run AI, plagiarism, paraphrase, citation and hallucination checks." },
    ],
  }),
  component: Analyze,
});

type Ref = { name: string; text: string };
const STAGES = ["Extracting & cleaning text", "Stylometric features", "Transformer AI classifier", "Embedding similarity", "Citation & claim verification", "Compiling report"];

function FilePick({ onText, label }: { onText: (name: string, text: string) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-muted">
      <Upload className="h-4 w-4" /> {label}
      <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        try { onText(f.name, await extractText(f)); toast.success(`Extracted text from ${f.name}`); }
        catch (err) { toast.error((err as Error).message); }
        e.target.value = "";
      }} />
    </label>
  );
}

function Analyze() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [refs, setRefs] = useState<Ref[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const run = useServerFn(analyzeSubmission);
  const navigate = useNavigate();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function go() {
    setBusy(true);
    setStage(0);
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3500);
    try {
      const { id } = await run({ data: { title: title || "Untitled submission", text, references: refs } });
      navigate({ to: "/reports/$id", params: { id } });
    } catch (e) {
      toast.error((e as Error).message || "Analysis failed");
    } finally {
      clearInterval(t);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Module 1 · Upload & preprocess</p>
      <h1 className="mt-2 text-5xl">New investigation</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="t">Title</Label><Input id="t" placeholder="e.g. Essay on climate policy — Student 23" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sub">Submission text</Label>
            <FilePick label="Upload PDF / DOCX / TXT" onText={(n, t) => { setText(t); if (!title) setTitle(n.replace(/\.[^.]+$/, "")); }} />
          </div>
          <Textarea id="sub" className="min-h-[360px] bg-card font-sans" placeholder="Paste the student's submission here…" value={text} onChange={(e) => setText(e.target.value)} />
          <p className="font-mono text-xs text-muted-foreground">{words} words</p>
        </div>

        <aside className="space-y-4">
          <div className="rounded-md border bg-card p-4 shadow-paper">
            <p className="font-medium">Reference sources</p>
            <p className="mt-1 text-xs text-muted-foreground">Optional. Add source papers or other submissions to enable exact plagiarism, semantic and paraphrase matching, and claim verification against them.</p>
            <div className="mt-3 space-y-2">
              {refs.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-sm border bg-muted/50 px-2 py-1.5 text-sm">
                  <span className="truncate">{r.name} <span className="font-mono text-xs text-muted-foreground">({r.text.split(/\s+/).length}w)</span></span>
                  <button onClick={() => setRefs(refs.filter((_, j) => j !== i))} aria-label="Remove"><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <FilePick label="Add file" onText={(n, t) => setRefs([...refs, { name: n, text: t }])} />
              <Button variant="outline" size="sm" onClick={() => {
                const t = prompt("Paste reference text");
                if (t) setRefs([...refs, { name: `Pasted source ${refs.length + 1}`, text: t }]);
              }}><Plus /> Paste</Button>
            </div>
          </div>

          <Button size="lg" className="w-full" disabled={busy || text.length < 80} onClick={go}>
            {busy ? <><Loader2 className="animate-spin" /> Investigating…</> : "Run full analysis"}
          </Button>
          {busy && (
            <ol className="space-y-1.5 rounded-md border bg-card p-4 text-sm">
              {STAGES.map((s, i) => (
                <li key={s} className={i < stage ? "text-success" : i === stage ? "font-medium" : "text-muted-foreground"}>
                  {i < stage ? "✓" : i === stage ? "›" : "·"} {s}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}
