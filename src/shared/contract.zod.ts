import { z } from "zod";

/**
 * zod schemas mirroring src/shared/contract.ts / docs/cli-json-contract.md.
 * These validate every CLI response at the executor boundary — a shape
 * mismatch becomes a clear parse error instead of a runtime `undefined`.
 */

export const cliWarningSchema = z.object({
  message: z.string(),
  detail: z.string().optional(),
  scope: z.string().optional(),
});

export const cliErrorKindSchema = z.enum([
  "not_a_repo",
  "identity_missing",
  "not_found",
  "ambiguous_id",
  "validation",
  "conflict",
  "rejected",
  "remote",
  "io",
  "internal",
]);

export const cliErrorSchema = z.object({
  kind: cliErrorKindSchema,
  message: z.string(),
  causes: z.array(z.string()),
  context: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
});

export function cliResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.discriminatedUnion("ok", [
    z.object({
      ok: z.literal(true),
      command: z.string(),
      version: z.string(),
      data: dataSchema,
      warnings: z.array(cliWarningSchema),
    }),
    z.object({
      ok: z.literal(false),
      command: z.string(),
      version: z.string(),
      error: cliErrorSchema,
      warnings: z.array(cliWarningSchema),
    }),
  ]);
}

export const taskKindSchema = z.enum(["bug", "story", "task", "epic", "subtask"]);
export const prioritySchema = z.enum(["low", "medium", "high"]);
export const linkKindSchema = z.enum(["blocks", "relates", "dup"]);

export const commentJsonSchema = z.object({
  id: z.number(),
  author: z.string(),
  author_name: z.string(),
  timestamp: z.number(),
  text: z.string(),
  edited: z.boolean(),
});

export const linkJsonSchema = z.object({
  kind: linkKindSchema,
  target: z.string(),
  target_display_id: z.string(),
});

export const opEnvelopeJsonSchema = z
  .object({
    author: z.object({ name: z.string(), email: z.string() }),
    timestamp: z.number(),
    op: z.string(),
  })
  .catchall(z.unknown());

export const taskJsonSchema = z.object({
  id: z.string(),
  display_id: z.string(),
  key: z.string(),
  title: z.string(),
  description: z.string(),
  kind: taskKindSchema,
  status: z.string(),
  priority: prioritySchema.nullable(),
  assignee: z.string().nullable(),
  assignee_name: z.string().nullable(),
  reporter: z.string(),
  reporter_name: z.string(),
  labels: z.array(z.string()),
  fixed_versions: z.array(z.string()),
  affected_versions: z.array(z.string()),
  due: z.string().nullable(),
  parent: z.string().nullable(),
  parent_display_id: z.string().nullable(),
  links: z.array(linkJsonSchema),
  milestone: z.string().nullable(),
  comments: z.array(commentJsonSchema),
  deleted: z.boolean(),
  created: z.number(),
  updated: z.number(),
  history: z.array(opEnvelopeJsonSchema).optional(),
});

export const lsJsonSchema = z.object({
  scope: z.object({
    mode: z.enum(["here", "registry"]),
    repo_count: z.number(),
    branch: z.string().nullable(),
  }),
  filters_applied: z.object({
    status: z.string().nullable(),
    assignee: z.string().nullable(),
    label: z.string().nullable(),
    fixed_version: z.string().nullable(),
    affected_version: z.string().nullable(),
    kind: z.string().nullable(),
    parent: z.string().nullable(),
    mine: z.boolean(),
    deleted: z.boolean(),
  }),
  repos: z.array(
    z.object({
      name: z.string(),
      project: z.string(),
      path: z.string(),
      key: z.string(),
      branch: z.string().nullable(),
      tasks: z.array(taskJsonSchema),
    }),
  ),
  contributors: z.record(z.string(), z.string()),
  statuses: z.array(z.string()),
  total: z.number(),
});

export const mutationJsonSchema = z.object({
  task: taskJsonSchema,
  ops: z.array(z.string()),
  automation: z.array(
    z.object({
      rule: z.string(),
      actions: z.array(z.string()),
      ops: z.array(z.string()),
      error: z.string().optional(),
    }),
  ),
  created: z.boolean().optional(),
});

export const dropJsonSchema = z.object({
  id: z.string(),
  display_id: z.string(),
  title: z.string(),
  kind: taskKindSchema,
  remote_deleted: z.string().nullable(),
});

export const identityInfoJsonSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  ok: z.boolean(),
  source: z.enum(["repo", "global", "system", "none"]),
});

export const registryRepoJsonSchema = z.object({
  name: z.string(),
  path: z.string(),
  project: z.string(),
  exists: z.boolean().nullable(),
  openable: z.boolean().nullable(),
  key: z.string().nullable(),
  branch: z.string().nullable(),
  task_count: z.number().nullable(),
  open_task_count: z.number().nullable(),
  remotes: z
    .array(z.object({ name: z.string(), url: z.string().nullable(), push_url: z.string().nullable() }))
    .nullable(),
  identity: identityInfoJsonSchema.nullable(),
  error: z.string().nullable(),
});

export const registryJsonSchema = z.object({
  config_dir: z.string(),
  default_project: z.string(),
  projects: z.array(z.string()),
  repos: z.array(registryRepoJsonSchema),
});

export const projectsJsonSchema = z.object({
  default_project: z.string(),
  projects: z.array(z.object({ name: z.string(), repos: z.array(z.string()) })),
});

export const registryMutationActionSchema = z.enum([
  "registered",
  "moved",
  "noop",
  "unregistered",
  "project_created",
  "project_renamed",
  "project_deleted",
  "default_set",
]);

export const registryMutationJsonSchema = z.object({
  action: registryMutationActionSchema,
  name: z.string(),
  project: z.string().optional(),
  previous_project: z.string().optional(),
  registry: registryJsonSchema,
});

export const repoConfigJsonSchema = z.object({
  key: z.string(),
  key_source: z.enum(["config", "derived"]),
  fields: z.object({
    priority: z.object({ required: z.boolean(), source: z.enum(["repo", "global", "default"]) }),
    assignee: z.object({ required: z.boolean(), source: z.enum(["repo", "global", "default"]) }),
    due: z.object({ required: z.boolean(), source: z.enum(["repo", "global", "default"]) }),
  }),
  rules: z.array(
    z.object({
      scope: z.enum(["global", "repo"]),
      name: z.string(),
      on: z.string(),
      when: z.string().nullable(),
      actions: z.array(z.string()),
    }),
  ),
});

export const refResultJsonSchema = z.object({
  ref: z.string(),
  task_id: z.string().nullable(),
  display_id: z.string().nullable(),
  status: z.enum(["ok", "rejected"]),
  message: z.string().nullable(),
});

export const pushJsonSchema = z.object({
  remote: z.string(),
  attempted: z.number(),
  pushed: z.number(),
  refs: z.array(refResultJsonSchema),
  rejected: z.array(refResultJsonSchema),
  config_ref_pushed: z.boolean(),
  nothing_to_push: z.boolean(),
});

export const pullJsonSchema = z.object({
  remote: z.string(),
  counts: z.object({
    new: z.number(),
    fast_forwarded: z.number(),
    merged: z.number(),
    up_to_date: z.number(),
  }),
  config: z.enum(["new", "fast_forwarded", "merged", "up_to_date"]).nullable(),
  tasks: z.array(z.object({ id: z.string(), display_id: z.string(), outcome: z.string() })),
});

export const cloneJsonSchema = z.object({
  url: z.string(),
  dir: z.string(),
  task_count: z.number(),
  key: z.string().nullable(),
});

export const whoamiJsonSchema = z.object({
  repo: identityInfoJsonSchema.optional(),
  global: identityInfoJsonSchema,
  effective: identityInfoJsonSchema,
});
