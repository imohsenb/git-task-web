import type { LsFilters } from "./api";

export const queryKeys = {
  registry: ["registry"] as const,
  repoTasks: (repo: string, filters: LsFilters) => ["tasks", repo, filters] as const,
  allTasks: (filters: LsFilters & { project?: string }) => ["tasksAll", filters] as const,
  allTasksLite: ["tasksAllLite"] as const,
  task: (repo: string, displayId: string) => ["task", repo, displayId] as const,
  fields: (repo: string) => ["fields", repo] as const,
  taskPrs: (repo: string, displayId: string) => ["taskPrs", repo, displayId] as const,
  repoPrs: (repo: string) => ["repoPrs", repo] as const,
  projectPrs: (project: string) => ["projectPrs", project] as const,
};
