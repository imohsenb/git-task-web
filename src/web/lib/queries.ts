import { useQuery } from "@tanstack/react-query";
import { apiGet, type LsFilters } from "./api";
import { queryKeys } from "./queryKeys";
import type {
  LsJson,
  MetaJson,
  ProjectPrsResponseJson,
  RegistryJson,
  RepoConfigJson,
  RepoPrsResponseJson,
  TaskJson,
  TaskPrsResponseJson,
} from "../../shared/contract";

export function useMeta() {
  return useQuery({
    queryKey: ["meta"] as const,
    queryFn: () => apiGet<MetaJson>("/meta"),
    staleTime: 30_000,
    retry: false,
  });
}

export function useRegistry() {
  return useQuery({
    queryKey: queryKeys.registry,
    queryFn: () => apiGet<RegistryJson>("/registry"),
    staleTime: 30_000,
  });
}

export function useRepoTasks(repo: string, filters: LsFilters = {}) {
  return useQuery({
    queryKey: queryKeys.repoTasks(repo, filters),
    queryFn: () => apiGet<LsJson>(`/repos/${encodeURIComponent(repo)}/tasks`, filters),
    staleTime: 10_000,
    enabled: repo.length > 0,
  });
}

export function useAllTasks(filters: LsFilters & { project?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.allTasks(filters),
    queryFn: () => apiGet<LsJson>("/tasks", filters),
    staleTime: 10_000,
  });
}

export function useTask(repo: string, displayId: string) {
  return useQuery({
    queryKey: queryKeys.task(repo, displayId),
    queryFn: () => apiGet<TaskJson>(`/repos/${encodeURIComponent(repo)}/tasks/${encodeURIComponent(displayId)}`),
    staleTime: 10_000,
    enabled: repo.length > 0 && displayId.length > 0,
  });
}

/** NewTaskDialog's required-field schema — so a missing required field blocks
 * submission in the form instead of surfacing as a `new.rs:76` CLI error. */
export function useFields(repo: string) {
  return useQuery({
    queryKey: queryKeys.fields(repo),
    queryFn: () => apiGet<RepoConfigJson>(`/repos/${encodeURIComponent(repo)}/fields`),
    staleTime: 60_000,
    enabled: repo.length > 0,
  });
}

export function useTaskPrs(repo: string, displayId: string) {
  return useQuery({
    queryKey: queryKeys.taskPrs(repo, displayId),
    queryFn: () =>
      apiGet<TaskPrsResponseJson>(
        `/repos/${encodeURIComponent(repo)}/tasks/${encodeURIComponent(displayId)}/prs`,
      ),
    staleTime: 60_000,
    enabled: repo.length > 0 && displayId.length > 0,
  });
}

export function useRepoPrs(repo: string) {
  return useQuery({
    queryKey: queryKeys.repoPrs(repo),
    queryFn: () => apiGet<RepoPrsResponseJson>(`/repos/${encodeURIComponent(repo)}/prs`),
    staleTime: 60_000,
    enabled: repo.length > 0,
  });
}

export function useProjectPrs(project: string) {
  return useQuery({
    queryKey: queryKeys.projectPrs(project),
    queryFn: () => apiGet<ProjectPrsResponseJson>(`/projects/${encodeURIComponent(project)}/prs`),
    staleTime: 60_000,
    enabled: project.length > 0,
  });
}

