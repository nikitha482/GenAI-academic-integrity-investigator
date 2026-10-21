// Pure, deterministic text-analysis helpers (run on server and client).

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter((s) => s.split(" ").length >= 4);
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

export function chunkText(text: string, wordsPerChunk = 60): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let cur: string[] = [];
  let count = 0;
  for (const s of sentences) {
    cur.push(s);
    count += s.split(" ").length;
    if (count >= wordsPerChunk) {
      chunks.push(cur.join(" "));
      cur = [];
      count = 0;
    }
  }
  if (cur.length) chunks.push(cur.join(" "));
  return chunks;
}

const FUNCTION_WORDS = new Set(
  "the of and to a in is that it for as with was on be by this are or from at an which not have has but its can their also these such more been they other into".split(" "),
);
const AI_MARKERS = [
  "delve", "furthermore", "moreover", "in conclusion", "it is important to note", "plays a crucial role",
  "in today's", "ever-evolving", "landscape", "tapestry", "pivotal", "seamless", "leverage", "robust",
  "comprehensive", "notably", "additionally", "foster", "underscore", "multifaceted", "realm", "harness",
];

export type Stylometry = {
  sentenceCount: number;
  wordCount: number;
  avgSentenceLength: number;
  burstiness: number; // coefficient of variation of sentence length
  typeTokenRatio: number;
  functionWordRatio: number;
  aiMarkerDensity: number; // per 100 words
  repetitionRate: number; // repeated trigrams share
  aiLikelihood: number; // 0-100 heuristic
};

export function stylometry(text: string): Stylometry {
  const sentences = splitSentences(text);
  const tokens = tokenize(text);
  const wc = tokens.length || 1;
  const lens = sentences.map((s) => tokenize(s).length);
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1));
  const burstiness = mean ? sd / mean : 0;
  const window = tokens.slice(0, 1500);
  const ttr = new Set(window).size / (window.length || 1);
  const fw = tokens.filter((t) => FUNCTION_WORDS.has(t)).length / wc;
  const lower = text.toLowerCase();
  const markers = AI_MARKERS.reduce((n, m) => n + (lower.split(m).length - 1), 0);
  const markerDensity = (markers / wc) * 100;
  const tri = new Map<string, number>();
  for (let i = 0; i < tokens.length - 2; i++) {
    const k = tokens.slice(i, i + 3).join(" ");
    tri.set(k, (tri.get(k) ?? 0) + 1);
  }
  const repeated = [...tri.values()].filter((v) => v > 1).reduce((a, b) => a + b, 0);
  const repetitionRate = repeated / (tri.size || 1);

  // Low burstiness, uniform sentences, high marker density => more AI-like.
  let score = 50;
  score += (0.45 - Math.min(burstiness, 0.9)) * 70;
  score += Math.min(markerDensity, 2) * 12;
  score += mean > 18 && mean < 28 ? 6 : -4;
  score += ttr < 0.42 ? 4 : 0;
  const aiLikelihood = Math.max(2, Math.min(98, Math.round(score)));

  return {
    sentenceCount: sentences.length,
    wordCount: tokens.length,
    avgSentenceLength: +mean.toFixed(1),
    burstiness: +burstiness.toFixed(3),
    typeTokenRatio: +ttr.toFixed(3),
    functionWordRatio: +fw.toFixed(3),
    aiMarkerDensity: +markerDensity.toFixed(2),
    repetitionRate: +repetitionRate.toFixed(3),
    aiLikelihood,
  };
}

function shingles(tokens: string[], n: number): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) s.add(tokens.slice(i, i + n).join(" "));
  return s;
}

export type LexicalMatch = { source: string; containment: number; jaccard: number; passages: string[] };

/** Word 5-gram containment: share of submission shingles found in the reference. */
export function lexicalOverlap(submission: string, refName: string, reference: string): LexicalMatch {
  const a = tokenize(submission);
  const b = tokenize(reference);
  const sa = shingles(a, 5);
  const sb = shingles(b, 5);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const containment = sa.size ? inter / sa.size : 0;
  const jaccard = sa.size + sb.size ? inter / (sa.size + sb.size - inter) : 0;
  // Extract longest matching runs as evidence passages.
  const passages: string[] = [];
  let i = 0;
  while (i <= a.length - 5 && passages.length < 6) {
    if (sb.has(a.slice(i, i + 5).join(" "))) {
      let j = i + 5;
      while (j < a.length && sb.has(a.slice(j - 4, j + 1).join(" "))) j++;
      if (j - i >= 8) passages.push(a.slice(i, j).join(" "));
      i = j;
    } else i++;
  }
  return { source: refName, containment, jaccard, passages };
}

export function lexicalSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a).filter((t) => !FUNCTION_WORDS.has(t)));
  const tb = new Set(tokenize(b).filter((t) => !FUNCTION_WORDS.has(t)));
  let inter = 0;
  for (const x of ta) if (tb.has(x)) inter++;
  return ta.size + tb.size ? inter / (ta.size + tb.size - inter) : 0;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
