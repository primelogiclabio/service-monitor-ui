/** Short-lived messages shown at the bottom of the screen. */
export const toasts = $state([]);

let nextId = 1;

export function notify(message, kind = 'info', ms = 4500) {
  const id = nextId++;
  toasts.push({ id, message, kind });
  setTimeout(() => dismiss(id), kind === 'error' ? ms * 2 : ms);
}

export function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}
