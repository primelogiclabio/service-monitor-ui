// Where the info popover goes: centred under its icon, kept inside the window, flipped above when there is no room below.

const GAP = 6;
const MARGIN = 8;

/**
 * @param {{ left: number, right: number, top: number, bottom: number }} anchor the icon's rectangle
 * @param {{ width: number, height: number }} view the window size
 * @param {{ maxWidth?: number, height?: number }} pop the popover's wanted width and its (estimated) height
 * @returns {{ left: number, top: number, width: number, above: boolean }} `top` is the popover's top edge when below,
 *   or its bottom edge when above
 */
export function placeTip(anchor, view, pop = {}) {
  const width = Math.min(pop.maxWidth ?? 320, view.width - 2 * MARGIN);
  const centre = (anchor.left + anchor.right) / 2;
  const left = Math.min(Math.max(MARGIN, centre - width / 2), view.width - width - MARGIN);
  const height = pop.height ?? 120;
  const above = anchor.bottom + GAP + height > view.height && anchor.top - GAP - height >= 0;
  return { left, width, above, top: above ? anchor.top - GAP : anchor.bottom + GAP };
}
