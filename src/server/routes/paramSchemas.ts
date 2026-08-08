import { z } from "zod";

/** Shared between routes/tasks.ts (reads) and routes/taskMutations.ts (writes) —
 * both key off the same :name/:id route params. */
export const NAME_MAX_LEN = 200;

export const repoParamSchema = z.object({
  name: z.string().min(1).max(NAME_MAX_LEN),
});

export const repoTaskParamSchema = repoParamSchema.extend({
  id: z.string().min(1).max(NAME_MAX_LEN),
});

export const projectParamSchema = z.object({
  project: z.string().min(1).max(NAME_MAX_LEN),
});

/** Query strings arrive as strings; this normalises the handful of truthy/falsy
 * spellings a browser or curl might send ("", "1", "true") into a real boolean
 * without the z.coerce.boolean() footgun (which treats "false" as truthy — any
 * non-empty string coerces to true). Anything else fails validation instead of
 * silently guessing. */
export const booleanQueryParam = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === "" || value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return value;
}, z.boolean().optional());
