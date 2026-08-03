import { runGitTask, type RunGitTaskOptions } from "./executor.js";
import { whoamiJsonSchema } from "../../shared/contract.zod.js";
import type { WhoamiJson } from "../../shared/contract.js";

/**
 * The only argv builder. Every command below assembles its own argv and calls
 * runGitTask — no other file constructs a git-task argv or calls execa.
 */
export interface GitTaskContext {
  bin: string;
  cwd: string;
  configDir: string;
  timeoutMs?: number;
  /** Test/deploy-only env overrides — see RunGitTaskOptions.env. */
  env?: NodeJS.ProcessEnv;
}

export async function whoami(ctx: GitTaskContext): Promise<WhoamiJson> {
  const opts: RunGitTaskOptions = { ...ctx, args: ["whoami"], commandLabel: "whoami" };
  const { data } = await runGitTask(whoamiJsonSchema, opts);
  return data;
}
