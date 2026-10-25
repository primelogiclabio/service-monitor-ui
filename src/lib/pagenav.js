// Which section of a long page the reader is in, for the jump menu on the Help page.

/**
 * `tops` lists each section's distance from the top of the window, in page order. The reader is in the last section
 * whose top has reached `line`; above the first one that is still the first.
 */
export function activeSection(tops, line) {
  let id = tops[0]?.id ?? '';
  for (const t of tops) if (t.top <= line) id = t.id;
  return id;
}
