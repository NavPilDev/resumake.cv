/** Joins class name fragments, dropping falsy values. No conditional-conflict
 * resolution (tailwind-merge) — this app's class lists don't need it. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
