import type { CandidateStatus } from '../lib/types';
import { titleCase } from '../lib/format';

/**
 * Candidate counts per pipeline stage: one series comparing magnitude across
 * ordered categories, so it is a single-hue horizontal bar chart — no legend
 * (there is only one thing plotted) and a value directly labelled at each tip.
 * Bar colour is the brand hue in both themes; both were checked against their
 * surface for contrast.
 */
export function PipelineBars({
  data,
}: {
  data: { status: CandidateStatus; count: number }[];
}) {
  const max = Math.max(1, ...data.map((row) => row.count));
  const total = data.reduce((sum, row) => sum + row.count, 0);

  if (total === 0) {
    return <p className="px-5 py-8 text-center text-[13px] text-muted">No candidates in scope yet.</p>;
  }

  return (
    <div className="space-y-3 px-5 py-5">
      {data.map((row) => (
        <div key={row.status} className="grid grid-cols-[104px_1fr_28px] items-center gap-3">
          <span className="text-[12px] text-muted">{titleCase(row.status)}</span>
          <div
            className="h-2.5 rounded-full bg-subtle"
            title={`${titleCase(row.status)}: ${row.count} candidate${row.count === 1 ? '' : 's'}`}
          >
            <div
              className="h-2.5 rounded-r-[4px] bg-brand transition-[width] duration-500"
              style={{ width: `${Math.max(row.count === 0 ? 0 : 4, (row.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-right text-[12px] font-semibold tabular-nums text-ink">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}
