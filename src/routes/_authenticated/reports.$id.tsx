import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ReportView } from "@/components/report/ReportView";
import type { AnalysisResult } from "@/lib/analysis/types";

export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({
    meta: [
      { title: "Integrity report — Integrity Investigator" },
      { name: "description", content: "Detailed academic integrity report with scores and evidence." },
      { property: "og:title", content: "Integrity report — Integrity Investigator" },
      { property: "og:description", content: "Scores, evidence and verdict for a submission." },
    ],
  }),
  component: Report,
});

// Builds a PDF file directly and downloads it (no print dialog).
async function downloadPdf(r: AnalysisResult, id: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const W = doc.internal.pageSize.getWidth() - M * 2;
  const H = doc.internal.pageSize.getHeight();
  let y = M;

  const clean = (t: unknown) =>
    String(t ?? "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\x0A\x20-\x7E\xA0-\xFF]/g, "");

  const write = (text: unknown, size = 10, bold = false, gap = 4, indent = 0) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(text), W - indent) as string[];
    for (const line of lines) {
      if (y + size > H - M) {
        doc.addPage();
        y = M;
      }
      doc.text(line, M + indent, y + size);
      y += size * 1.35;
    }
    y += gap;
  };
  const heading = (t: string) => {
    y += 10;
    write(t, 14, true, 6);
  };

  const s = r.scores;
  write("ACADEMIC INTEGRITY REPORT", 9, true, 2);
  write(r.title, 20, true, 4);
  write(`${r.wordCount} words | ${format(new Date(r.createdAt), "d MMM yyyy, HH:mm")} | ID ${id.slice(0, 8)}`, 9, false, 10);

  heading("Scores");
  write(`Integrity score: ${s.integrity}% (higher is better)`);
  write(`AI-generated: ${s.ai}%`);
  write(`Human-written: ${s.human}%`);
  write(`Plagiarism${r.plagiarism.mode === "estimated" ? " (estimated)" : ""}: ${s.plagiarism}%`);
  write(`Semantic similarity: ${s.semantic}%`);
  write(`Paraphrased: ${s.paraphrase}%`);

  heading("Examiner verdict");
  write(r.verdict, 11);

  heading("01  AI vs human content");
  write(r.aiDetection.summary);
  write(`Model score: ${r.aiDetection.modelScore}% | Stylometric score: ${r.aiDetection.stylometricScore}%`, 9);
  r.aiDetection.sentences.forEach((x) => write(`[${x.label.toUpperCase()} ${x.confidence}%] ${x.text}`, 9, false, 3, 8));

  heading("02  Plagiarism");
  if (r.plagiarism.mode === "estimated") write("No reference documents were supplied, so this is an estimate of overlap with well-known published sources.", 9);
  if (r.plagiarism.knownSourceNotes) write(r.plagiarism.knownSourceNotes);
  r.plagiarism.sources.forEach((src) => {
    write(`${src.source} - ${src.containment}% overlap`, 10, true, 2);
    src.passages.forEach((p) => write(`"${p}"`, 9, false, 3, 8));
  });

  heading("03  Semantic similarity & paraphrasing");
  if (r.semantic.matches.length === 0) write("No semantically similar passages found.");
  r.semantic.matches.forEach((m) => {
    write(`Submission: ${m.submission}`, 9, false, 1, 8);
    write(`${m.source}: ${m.reference}`, 9, false, 1, 8);
    write(`semantic ${(m.similarity * 100).toFixed(0)}% | lexical ${(m.lexical * 100).toFixed(0)}%${m.paraphrased ? " | likely paraphrased" : ""}`, 9, true, 6, 8);
  });

  heading("04  Citations & references");
  if (r.citations.items.length === 0) write("No citations found in this submission.");
  r.citations.items.forEach((c) => {
    write(`[${c.status.replace("_", " ").toUpperCase()}] ${c.citation}`, 10, true, 1, 8);
    write(c.note, 9, false, 5, 8);
  });

  heading("05  Claims & hallucination check");
  if (r.claims.status === "no_claims") write("No claims");
  r.claims.items.forEach((c) => {
    write(`[${c.verdict.replace(/_/g, " ").toUpperCase()}] ${c.claim}`, 10, true, 1, 8);
    write(c.evidence, 9, false, 1, 8);
    write(`Source: ${c.source}`, 8, false, 5, 8);
  });

  heading("06  Recommendations for the reviewer");
  r.recommendations.forEach((x, i) => write(`${i + 1}. ${x}`, 10, false, 3, 8));

  y += 12;
  write("AI-detection results are probabilistic indicators, not proof of misconduct. Use the evidence above to guide a fair human review.", 8);

  const name = (r.title || "integrity-report").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60);
  doc.save(`${name}.pdf`);
}

function Report() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (isLoading) return <p className="p-20 text-center text-muted-foreground">Loading report…</p>;
  if (!data) return <p className="p-20 text-center">Report not found. <Link to="/reports" className="text-primary underline">Back</Link></p>;
  const r = data.result as unknown as AnalysisResult;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/reports"><ArrowLeft /> All reports</Link></Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              await downloadPdf(r, id);
            } catch (e) {
              toast.error("Could not create the PDF: " + (e as Error).message);
            }
          }}><Download /> Download</Button>
          <Button variant="outline" size="sm" onClick={async () => {
            if (!confirm("Delete this report?")) return;
            await supabase.from("reports").delete().eq("id", id);
            navigate({ to: "/reports" });
          }}><Trash2 /> Delete</Button>
        </div>
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-signal">Academic integrity report</p>
      <h1 className="mt-2 text-5xl">{r.title}</h1>
      <p className="mt-2 font-mono text-xs text-muted-foreground">{r.wordCount} words · {format(new Date(data.created_at), "d MMM yyyy, HH:mm")} · ID {id.slice(0, 8)}</p>
      <div className="mt-8"><ReportView r={r} /></div>
      <p className="mt-12 text-xs text-muted-foreground">AI-detection results are probabilistic indicators, not proof of misconduct. Use the evidence above to guide a fair human review.</p>
    </div>
  );
}