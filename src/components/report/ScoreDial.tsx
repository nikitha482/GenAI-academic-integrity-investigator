import { cn } from "@/lib/utils";

export function toneFor(value: number, invert = false) {
  const v = invert ? 100 - value : value;
  if (v >= 60) return "text-destructive";
  if (v >= 30) return "text-warning";
  return "text-success";
}

export function ScoreDial({ label, value, invert = false, hint }: { label: string; value: number; invert?: boolean; hint?: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border bg-card p-4 shadow-paper">
      <div className={cn("relative h-24 w-24", toneFor(value, invert))}>
        <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="6" />
          <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} className="transition-all duration-700" />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-mono text-xl text-foreground">{value}%</span>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
