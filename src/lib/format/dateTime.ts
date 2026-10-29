import { NO_VALUE } from './loanTerms';

/**
 * A timestamp as a reader would write it — `Oct 15, 2026, 9:27 PM` — rather than
 * the raw ISO string the API sends (`2026-10-15T21:27:40.373371+03:00`).
 *
 * Shown in the viewer's own timezone. A value that does not parse is returned
 * as received rather than hidden: an odd-looking date is still more useful to
 * the farmer than a dash that says nothing was recorded.
 */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return NO_VALUE;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
