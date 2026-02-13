export function TimerPage() {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="font-brand text-lg font-semibold tracking-wide text-foreground">Today</h1>
        <div className="flex gap-2">
          <button className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs text-foreground">
            This Week
          </button>
          <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            + Manual Entry
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] px-4 py-3.5">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Today
          </div>
          <div className="font-brand text-[22px] font-bold text-primary">0h 00m</div>
          <div className="mt-0.5 text-[10px] text-[hsl(var(--t-text-muted))]">of 8h target</div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] px-4 py-3.5">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            This Week
          </div>
          <div className="font-brand text-[22px] font-bold text-foreground">0h 00m</div>
          <div className="mt-0.5 text-[10px] text-[hsl(var(--t-text-muted))]">of 40h target</div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--t-border-subtle))] bg-[hsl(var(--t-stat-bg))] px-4 py-3.5">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Leave Balance
          </div>
          <div className="font-brand text-[22px] font-bold text-foreground">--</div>
          <div className="mt-0.5 text-[10px] text-[hsl(var(--t-text-muted))]">days remaining</div>
        </div>
      </div>

      {/* Timer bar placeholder */}
      <div className="mb-5 flex items-center gap-3 rounded-lg border border-[hsl(var(--t-timer-border))] bg-[hsl(var(--t-timer-bg))] px-4 py-3">
        <input
          className="flex-1 border-none bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="What are you working on?"
          readOnly
        />
        <span className="font-brand text-xl font-semibold tracking-wider text-primary">
          00:00:00
        </span>
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          ▶
        </button>
      </div>

      {/* Empty entries table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-border bg-muted/30 px-3.5 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">
                Task
              </th>
              <th className="border-b border-border bg-muted/30 px-3.5 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">
                Project
              </th>
              <th className="border-b border-border bg-muted/30 px-3.5 py-2.5 text-left text-[11px] font-semibold text-muted-foreground">
                Labels
              </th>
              <th className="border-b border-border bg-muted/30 px-3.5 py-2.5 text-right text-[11px] font-semibold text-muted-foreground">
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="px-3.5 py-10 text-center text-sm text-muted-foreground">
                No entries today. Start the timer to begin tracking.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
