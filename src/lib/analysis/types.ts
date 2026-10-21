import type { Stylometry } from "./text";

export type Verdict = "supported" | "partially_supported" | "not_supported";
export type CitationStatus = "valid" | "missing_reference" | "inconsistent" | "unverifiable" | "fabricated";

export type AnalysisResult = {
  title: string;
  wordCount: number;
  scores: {
    ai: number;
    human: number;
    plagiarism: number;
    semantic: number;
    paraphrase: number;
    integrity: number;
  };
  aiDetection: {
    modelScore: number;
    stylometricScore: number;
    summary: string;
    sentences: { text: string; label: "ai" | "human" | "mixed"; confidence: number }[];
  };
  stylometry: Stylometry;
  plagiarism: {
    mode: "reference" | "estimated";
    sources: { source: string; containment: number; passages: string[] }[];
    knownSourceNotes: string;
  };
  semantic: {
    matches: { submission: string; reference: string; source: string; similarity: number; lexical: number; paraphrased: boolean }[];
  };
  citations: { found: number; items: { citation: string; status: CitationStatus; note: string }[] };
  claims: { status: "checked" | "no_claims"; items: { claim: string; verdict: Verdict; evidence: string; source: string }[] };
  verdict: string;
  recommendations: string[];
  createdAt: string;
};
