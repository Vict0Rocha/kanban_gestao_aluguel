export const GAP = 1000

/**
 * Fractional-indexing helper: returns a position between two neighbors so
 * reordering only ever touches the moved row, never the whole list.
 */
export function positionBetween(
  before: number | undefined,
  after: number | undefined
): number {
  if (before === undefined && after === undefined) return GAP
  if (before === undefined) return after! - GAP
  if (after === undefined) return before + GAP
  return (before + after) / 2
}
