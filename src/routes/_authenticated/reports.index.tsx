import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toneFor } from "@/components/report/ScoreDial";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "Your reports — Integrity Investigator" },
      { name: "description", content: "All academic integrity reports you have generated." },
      { property: "og:title", content: "Your reports — Integrity Investigator" },
      { property: "og:description", content: "Review past integrity analyses." },
    ],
  }),
  component: Reports,
});

function Reports() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports")
        .select("id,title,word_count,ai_score,plagiarism_score,paraphrase_score,integrity_score,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex items-end justify-between">
        <h1 className="text-5xl">Reports</h1>
        <Button asChild><Link to="/analyze">New analysis</Link></Button>
      </div>
      {isLoading ? <p className="mt-10 text-muted-foreground">Loading…</p> : !data?.length ? (
        <div className="mt-10 rounded-md border bg-card p-10 text-center">
          <p className="text-muted-foreground">No reports yet.</p>
          <Button asChild className="mt-4"><Link to="/analyze">Analyze your first submission</Link></Button>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-md border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left font-mono text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Submission</th><th className="p-3">Date</th><th className="p-3">Words</th><th className="p-3">AI</th><th className="p-3">Plagiarism</th><th className="p-3">Paraphrase</th><th className="p-3">Integrity</th></tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="p-3"><Link to="/reports/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.title}</Link></td>
                  <td className="p-3 text-muted-foreground">{format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</td>
                  <td className="p-3 font-mono">{r.word_count}</td>
                  <td className={`p-3 font-mono ${toneFor(Number(r.ai_score))}`}>{Number(r.ai_score)}%</td>
                  <td className={`p-3 font-mono ${toneFor(Number(r.plagiarism_score))}`}>{Number(r.plagiarism_score)}%</td>
                  <td className={`p-3 font-mono ${toneFor(Number(r.paraphrase_score))}`}>{Number(r.paraphrase_score)}%</td>
                  <td className={`p-3 font-mono ${toneFor(Number(r.integrity_score), true)}`}>{Number(r.integrity_score)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
