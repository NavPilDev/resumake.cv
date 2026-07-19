/** Optional header contact fields a saved resume can toggle on/off — name
 * itself is always shown and isn't part of this list. Kept in its own
 * file (no fs/path imports) so client components can import it as a value
 * without pulling lib/resumeFiles.ts's server-only code into the browser
 * bundle. */
export const CONTACT_FIELDS = ["email", "linkedin", "github", "website"] as const;
