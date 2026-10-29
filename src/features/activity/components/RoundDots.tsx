import { cn } from "@/lib/utils";

/** Progress through a list of rounds: played dots filled, the current one bigger. */
const RoundDots = ({ total, current, done, label }: { total: number; current: number; done: number; label: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-full border-2 border-foreground bg-secondary px-4 py-2">
    <span className="text-sm font-semibold">{label}</span>
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full border-2 border-foreground transition-transform duration-300",
            i < done && "bg-primary",
            i === current && "story-pop scale-125 bg-sun",
          )}
        />
      ))}
    </span>
  </div>
);

export default RoundDots;
