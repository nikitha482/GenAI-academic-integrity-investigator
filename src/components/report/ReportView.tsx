import { Badge } from "@/components/ui/badge";
import type { AnalysisResult, CitationStatus, Verdict } from "@/lib/analysis/types";
import { ScoreDial } from "./ScoreDial";
import { cn } from "@/lib/utils";

const verdictStyle: Record<Verdict, string> = {
  supported: "bg-success text-success-foreground",
  partially_supported: "bg-warning text-warning-foreground",
  not_supported: "bg-destructive text-destructive-foreground",
};
const verdictLabel: Record<Verdict, string> = {
  supported: "Supported",
  partially_supported: "Partially supported",
  not_supported: "Not supported",
};
const citeStyle: Record<CitationStatus, string> = {
  valid: "bg-success text-success-foreground",
  unverifiable: "bg-secondary text-secondary-foreground",
  missing_reference: "bg-warning text-warning-foreground",
  inconsistent: "bg-warning text-warning-foreground",
  fabricated: "bg-destructive text-destructive-foreground",
};

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid border-t pt-8">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-xs text-signal">{n}</span>
        <h2 className="text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Bar({ value, tone = "bg-primary" }: { value: number; tone?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function ReportView({ r }: { r: AnalysisResult }) {
  const s = r.scores;
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <ScoreDial label="Integrity score" value={s.integrity} invert hint="Higher is better" />
        <ScoreDial label="AI-generated" value={s.ai} />
        <ScoreDial label="Human-written" value={s.human} invert />
        <ScoreDial label="Plagiarism" value={s.plagiarism} hint={r.plagiarism.mode === "estimated" ? "Estimated" : "vs references"} />
        <ScoreDial label="Semantic similarity" value={s.semantic} />
        <ScoreDial label="Paraphrased" value={s.paraphrase} />
      </div>

      <div className="rounded-md border bg-card p-6 shadow-paper">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Examiner verdict</p>
        <p className="mt-2 font-display text-2xl leading-snug">{r.verdict}</p>
      </div>

      <Section n="01" title="AI vs human content">
        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="space-y-3">
            <p className="text-muted-foreground">{r.aiDetection.summary}</p>
            <ul className="space-y-2">
              {r.aiDetection.sentences.map((x, i) => (
                <li key={i} className="flex gap-3 rounded-sm border bg-card p-3 text-sm">
                  <Badge className={cn("shrink-0 uppercase", x.label === "ai" ? "bg-destructive text-destructive-foreground" : x.label === "mixed" ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground")}>
                    {x.label} {x.confidence}%
                  </Badge>
                  <span>{x.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4 rounded-md border bg-muted/50 p-4 text-sm">
            <p className="font-medium">Ensemble breakdown</p>
            <div><div className="flex justify-between"><span>Transformer classifier</span><span className="font-mono">{r.aiDetection.modelScore}%</span></div><Bar value={r.aiDetection.modelScore} tone="bg-signal" /></div>
            <div><div className="flex justify-between"><span>Stylometric model</span><span className="font-mono">{r.aiDetection.stylometricScore}%</span></div><Bar value={r.aiDetection.stylometricScore} /></div>
            <dl className="grid grid-cols-2 gap-y-1 pt-2 font-mono text-xs">
              <dt className="text-muted-foreground">Burstiness</dt><dd>{r.stylometry.burstiness}</dd>
              <dt className="text-muted-foreground">Avg sentence</dt><dd>{r.stylometry.avgSentenceLength} words</dd>
              <dt className="text-muted-foreground">Type-token</dt><dd>{r.stylometry.typeTokenRatio}</dd>
              <dt className="text-muted-foreground">AI markers</dt><dd>{r.stylometry.aiMarkerDensity}/100w</dd>
              <dt className="text-muted-foreground">Repetition</dt><dd>{r.stylometry.repetitionRate}</dd>
              <dt className="text-muted-foreground">Sentences</dt><dd>{r.stylometry.sentenceCount}</dd>
            </dl>
          </div>
        </div>
      </Section>

      <Section n="02" title="Plagiarism">
        {r.plagiarism.mode === "estimated" && (
          <p className="mb-4 text-sm text-muted-foreground">No reference documents were supplied, so this is an estimate of overlap with well-known published sources. Add references for exact matching.</p>
        )}
        {r.plagiarism.knownSourceNotes && <p className="mb-4">{r.plagiarism.knownSourceNotes}</p>}
        <div className="space-y-4">
          {r.plagiarism.sources.map((src) => (
            <div key={src.source} className="rounded-md border bg-card p-4">
              <div className="mb-2 flex justify-between text-sm"><span className="font-medium">{src.source}</span><span className="font-mono">{src.containment}% overlap</span></div>
              <Bar value={src.containment} tone="bg-signal" />
              {src.passages.map((p, i) => (
                <blockquote key={i} className="mt-3 border-l-2 border-signal pl-3 text-sm italic text-muted-foreground">“{p}”</blockquote>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section n="03" title="Semantic similarity & paraphrasing">
        {r.semantic.matches.length === 0 ? (
          <p className="text-muted-foreground">No semantically similar passages found{r.plagiarism.mode === "estimated" ? " (add reference documents to enable embedding-level comparison)" : ""}.</p>
        ) : (
          <div className="space-y-3">
            {r.semantic.matches.map((m, i) => (
              <div key={i} className="grid gap-3 rounded-md border bg-card p-4 text-sm md:grid-cols-2">
                <div><p className="mb-1 font-mono text-xs text-muted-foreground">SUBMISSION</p>{m.submission}</div>
                <div><p className="mb-1 font-mono text-xs text-muted-foreground">{m.source}</p>{m.reference}</div>
                <div className="flex flex-wrap gap-2 md:col-span-2">
                  <Badge variant="outline" className="font-mono">semantic {(m.similarity * 100).toFixed(0)}%</Badge>
                  <Badge variant="outline" className="font-mono">lexical {(m.lexical * 100).toFixed(0)}%</Badge>
                  {m.paraphrased && <Badge className="bg-warning text-warning-foreground">Likely paraphrased</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section n="04" title="Citations & references">
        {r.citations.items.length === 0 ? (
          <p className="text-muted-foreground">No citations found in this submission.</p>
        ) : (
          <ul className="space-y-2">
            {r.citations.items.map((c, i) => (
              <li key={i} className="flex flex-col gap-2 rounded-sm border bg-card p-3 text-sm md:flex-row md:items-start">
                <Badge className={cn("shrink-0 capitalize", citeStyle[c.status])}>{c.status.replace("_", " ")}</Badge>
                <div><p className="font-medium">{c.citation}</p><p className="text-muted-foreground">{c.note}</p></div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n="05" title="Claims & hallucination check">
        {r.claims.status === "no_claims" ? (
          <p className="rounded-md border bg-card p-4 font-mono text-sm">No claims</p>
        ) : (
          <ul className="space-y-2">
            {r.claims.items.map((c, i) => (
              <li key={i} className="rounded-sm border bg-card p-3 text-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start">
                  <Badge className={cn("shrink-0", verdictStyle[c.verdict])}>{verdictLabel[c.verdict]}</Badge>
                  <div>
                    <p className="font-medium">{c.claim}</p>
                    <p className="text-muted-foreground">{c.evidence}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">Source: {c.source}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section n="06" title="Recommendations for the reviewer">
        <ol className="list-decimal space-y-1 pl-5">
          {r.recommendations.map((x, i) => <li key={i}>{x}</li>)}
        </ol>
      </Section>
    </div>
  );
}
