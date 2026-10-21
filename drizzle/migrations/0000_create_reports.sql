CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Untitled submission',
  word_count integer NOT NULL DEFAULT 0,
  ai_score numeric NOT NULL DEFAULT 0,
  human_score numeric NOT NULL DEFAULT 0,
  plagiarism_score numeric NOT NULL DEFAULT 0,
  semantic_score numeric NOT NULL DEFAULT 0,
  paraphrase_score numeric NOT NULL DEFAULT 0,
  integrity_score numeric NOT NULL DEFAULT 0,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own reports select" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own reports insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own reports delete" ON public.reports FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX reports_user_created_idx ON public.reports(user_id, created_at DESC);