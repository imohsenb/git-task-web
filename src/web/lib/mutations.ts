import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiPatch, apiPost, apiPut, ApiError, type ApiSuccess } from "./api";
import { queryKeys } from "./queryKeys";
import { useIdentityDialog } from "../components/identity/IdentityDialogContext";
import type {
  CloneAndRegisterJson,
  DropJson,
  LinkKind,
  LsJson,
  MutationJson,
  Priority,
  PullJson,
  PushJson,
  RegistryJson,
  RegistryMutationJson,
  SyncJson,
  TaskJson,
  TaskKind,
} from "../../shared/contract";

function repoTasksPath(repo: string): string {
  return `/repos/${encodeURIComponent(repo)}/tasks`;
}

function taskPath(repo: string, id: string, suffix = ""): string {
  return `${repoTasksPath(repo)}/${encodeURIComponent(id)}${suffix}`;
}

/** Patches one task by id across every cached `ls` response for this repo — the
 * per-repo list, the cross-repo `/tasks` aggregate (Home/Project), any filter
 * variant of either. Used for optimistic updates; the eventual `invalidateQueries`
 * in `applyTask` reconciles with server truth regardless. */
function patchListCaches(queryClient: QueryClient, repo: string, id: string, patch: Partial<TaskJson>) {
  const updater = (old: ApiSuccess<LsJson> | undefined) => {
    if (!old) return old;
    return {
      ...old,
      data: {
        ...old.data,
        repos: old.data.repos.map((r) =>
          r.name === repo ? { ...r, tasks: r.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) } : r,
        ),
      },
    };
  };
  queryClient.setQueriesData<ApiSuccess<LsJson>>({ queryKey: ["tasks", repo] }, updater);
  queryClient.setQueriesData<ApiSuccess<LsJson>>({ queryKey: ["tasksAll"] }, updater);
}

/** Shared by every mutation hook in this file. identity_missing (§3.2) opens the
 * dedicated dialog instead of a toast — the terminal command it needs isn't
 * actionable from a toast. */
function useApiErrorHandler() {
  const identityDialog = useIdentityDialog();
  return function onError(error: unknown) {
    if (error instanceof ApiError && error.kind === "identity_missing") {
      identityDialog.open(error);
      return;
    }
    toast.error(error instanceof Error ? error.message : "Request failed");
  };
}

/** Shared by every task mutation hook below. `applyTask`: pushes the mutation's
 * returned task straight into the task-detail cache (dialog/full page reflect the
 * write with no refetch round-trip) and invalidates every list/board/table query for
 * the repo so the card behind it updates too. */
function useMutationEffects(repo: string) {
  const queryClient = useQueryClient();
  const onError = useApiErrorHandler();

  function applyTask(task: TaskJson) {
    queryClient.setQueryData(queryKeys.task(repo, task.display_id), { data: task, warnings: [] });
    queryClient.invalidateQueries({ queryKey: ["tasks", repo] });
    queryClient.invalidateQueries({ queryKey: ["tasksAll"] });
  }

  return { onError, applyTask, queryClient };
}

/** Shared by every repos/projects registry mutation hook below (§1.3's
 * RegistryMutationJson family) — every one of them returns the complete fresh
 * registry, so the cache can be written straight from the response with no refetch,
 * same trick as applyTask above. */
function useRegistryMutationEffects() {
  const queryClient = useQueryClient();
  const onError = useApiErrorHandler();

  function applyRegistry(registry: RegistryJson) {
    queryClient.setQueryData(queryKeys.registry, { data: registry, warnings: [] });
  }

  return { onError, applyRegistry };
}

export interface NewTaskInput {
  title: string;
  kind: TaskKind;
  description: string;
  assignee?: string;
  labels?: string[];
  fixedVersions?: string[];
  affectedVersions?: string[];
  priority?: Priority;
  due?: string;
  milestone?: string;
  parent?: string;
  status?: string;
}

export function useCreateTask(repo: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: (input: NewTaskInput) => apiPost<MutationJson>(repoTasksPath(repo), input),
    onSuccess: (result) => {
      if (!result) return;
      applyTask(result.data.task);
      toast.success(`Created ${result.data.task.display_id}`);
    },
    onError,
  });
}

export interface EditTaskPatch {
  title?: string;
  description?: string;
  kind?: TaskKind;
  /** `undefined` = leave alone, `null` = clear, a value = set — mirrors the server's EditTaskInput. */
  priority?: Priority | null;
  assignee?: string | null;
  due?: string | null;
  milestone?: string | null;
}

export function useEditTask(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: (patch: EditTaskPatch) => apiPatch<MutationJson>(taskPath(repo, id), patch),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

interface SetStatusVars {
  id: string;
  status: string;
}

interface SetStatusContext {
  id: string;
  previousLists: [readonly unknown[], unknown][];
  previousTask: ApiSuccess<TaskJson> | undefined;
}

/**
 * Optimistic: the card must move columns the instant you drop it, not after a round
 * trip (§4.4 "Drag → status change"). Snapshots every cached list + the task detail,
 * patches them locally, rolls back on error. `onSuccess` replaces the optimistic
 * guess with the server's real task — if `automation[]` fired, that may not be the
 * status you dropped it on, so the invalidate-driven refetch is what actually lands
 * the card in its true column; the toast names the rule that moved it.
 */
export function useSetStatus(repo: string) {
  const { onError: baseOnError, applyTask, queryClient } = useMutationEffects(repo);

  return useMutation<ApiSuccess<MutationJson> | null, unknown, SetStatusVars, SetStatusContext>({
    mutationFn: ({ id, status }) => apiPut<MutationJson>(taskPath(repo, id, "/status"), { status }),

    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", repo] });
      await queryClient.cancelQueries({ queryKey: ["tasksAll"] });
      await queryClient.cancelQueries({ queryKey: queryKeys.task(repo, id) });

      const previousLists = [
        ...queryClient.getQueriesData<ApiSuccess<LsJson>>({ queryKey: ["tasks", repo] }),
        ...queryClient.getQueriesData<ApiSuccess<LsJson>>({ queryKey: ["tasksAll"] }),
      ];
      const previousTask = queryClient.getQueryData<ApiSuccess<TaskJson>>(queryKeys.task(repo, id));

      patchListCaches(queryClient, repo, id, { status });
      if (previousTask) {
        queryClient.setQueryData(queryKeys.task(repo, id), { ...previousTask, data: { ...previousTask.data, status } });
      }

      return { id, previousLists, previousTask };
    },

    onError: (error, _vars, context) => {
      context?.previousLists.forEach(([key, data]) => queryClient.setQueryData(key, data));
      if (context?.previousTask) queryClient.setQueryData(queryKeys.task(repo, context.id), context.previousTask);
      baseOnError(error);
    },

    onSuccess: (result) => {
      if (!result) return;
      applyTask(result.data.task);
      const bounced = result.data.automation.find((a) => a.actions.length > 0);
      if (bounced) toast.info(`Automation rule "${bounced.rule}" also ran on ${result.data.task.display_id}`);
    },
  });
}

export function useAddComment(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: (text: string) => apiPost<MutationJson>(taskPath(repo, id, "/comments"), { text }),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useEditComment(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: ({ commentNumber, text }: { commentNumber: number; text: string }) =>
      apiPatch<MutationJson>(taskPath(repo, id, `/comments/${commentNumber}`), { text }),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useAddLabel(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: (label: string) => apiPost<MutationJson>(taskPath(repo, id, "/labels"), { label }),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useRemoveLabel(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: (label: string) => apiDelete<MutationJson>(taskPath(repo, id, `/labels/${encodeURIComponent(label)}`)),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useSetParent(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: (epicId: string) => apiPut<MutationJson>(taskPath(repo, id, "/parent"), { epicId }),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useClearParent(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: () => apiDelete<MutationJson>(taskPath(repo, id, "/parent")),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useAddLink(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: ({ kind, target, targetRepo }: { kind: LinkKind; target: string; targetRepo?: string }) =>
      apiPost<MutationJson>(taskPath(repo, id, "/links"), { kind, target, targetRepo }),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useRemoveLink(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: ({ kind, target, targetRepo }: { kind: LinkKind; target: string; targetRepo?: string }) =>
      apiDelete<MutationJson>(
        taskPath(repo, id, `/links/${kind}/${encodeURIComponent(target)}`),
        targetRepo ? { repo: targetRepo } : undefined,
      ),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useDeleteTask(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: () => apiDelete<MutationJson>(taskPath(repo, id)),
    onSuccess: (result) => {
      if (!result) return;
      applyTask(result.data.task);
      toast.success(`Deleted ${result.data.task.display_id}`);
    },
    onError,
  });
}

export function useDropTask(repo: string, id: string) {
  const { onError, queryClient } = useMutationEffects(repo);
  return useMutation({
    mutationFn: (remote?: string) => apiDelete<DropJson>(taskPath(repo, id), remote ? { remote } : undefined),
    onSuccess: (result) => {
      if (!result) return;
      // drop has no task to push back into the cache — the ref is gone outright.
      queryClient.removeQueries({ queryKey: queryKeys.task(repo, result.data.display_id) });
      queryClient.invalidateQueries({ queryKey: ["tasks", repo] });
      queryClient.invalidateQueries({ queryKey: ["tasksAll"] });
      toast.success(`Dropped ${result.data.display_id}`);
    },
    onError,
  });
}

export interface RegisterRepoInput {
  path: string;
  name?: string;
  project?: string;
}

export function useRegisterRepo() {
  const { onError, applyRegistry } = useRegistryMutationEffects();
  return useMutation({
    mutationFn: (input: RegisterRepoInput) => apiPost<RegistryMutationJson>("/repos", input),
    onSuccess: (result) => {
      if (!result) return;
      applyRegistry(result.data.registry);
      toast.success(`Registered '${result.data.name}'`);
    },
    onError,
  });
}

export interface CloneRepoInput {
  url: string;
  dir?: string;
  name?: string;
  project?: string;
}

export function useCloneRepo() {
  const { onError, applyRegistry } = useRegistryMutationEffects();
  return useMutation({
    mutationFn: (input: CloneRepoInput) => apiPost<CloneAndRegisterJson>("/repos/clone", input),
    onSuccess: (result) => {
      if (!result) return;
      applyRegistry(result.data.register.registry);
      toast.success(`Cloned and registered '${result.data.register.name}' (${result.data.clone.task_count} tasks)`);
    },
    onError,
  });
}

export function useMoveRepoProject(name: string) {
  const { onError, applyRegistry } = useRegistryMutationEffects();
  return useMutation({
    mutationFn: (project: string) => apiPatch<RegistryMutationJson>(`/repos/${encodeURIComponent(name)}`, { project }),
    onSuccess: (result) => {
      if (result) applyRegistry(result.data.registry);
    },
    onError,
  });
}

export function useUnregisterRepo() {
  const { onError, applyRegistry } = useRegistryMutationEffects();
  return useMutation({
    mutationFn: (name: string) => apiDelete<RegistryMutationJson>(`/repos/${encodeURIComponent(name)}`),
    onSuccess: (result) => {
      if (!result) return;
      applyRegistry(result.data.registry);
      toast.success(`Unregistered '${result.data.name}'`);
    },
    onError,
  });
}

export function useCreateProject() {
  const { onError, applyRegistry } = useRegistryMutationEffects();
  return useMutation({
    mutationFn: (name: string) => apiPost<RegistryMutationJson>("/projects", { name }),
    onSuccess: (result) => {
      if (result) applyRegistry(result.data.registry);
    },
    onError,
  });
}

export function useRenameProject(name: string) {
  const { onError, applyRegistry } = useRegistryMutationEffects();
  return useMutation({
    mutationFn: (newName: string) => apiPatch<RegistryMutationJson>(`/projects/${encodeURIComponent(name)}`, { newName }),
    onSuccess: (result) => {
      if (result) applyRegistry(result.data.registry);
    },
    onError,
  });
}

export function useSetDefaultProject() {
  const { onError, applyRegistry } = useRegistryMutationEffects();
  return useMutation({
    mutationFn: (name: string) => apiPut<RegistryMutationJson>(`/projects/${encodeURIComponent(name)}/default`),
    onSuccess: (result) => {
      if (result) applyRegistry(result.data.registry);
    },
    onError,
  });
}

export function useDeleteProject() {
  const { onError, applyRegistry } = useRegistryMutationEffects();
  return useMutation({
    mutationFn: (name: string) => apiDelete<RegistryMutationJson>(`/projects/${encodeURIComponent(name)}`),
    onSuccess: (result) => {
      if (result) applyRegistry(result.data.registry);
    },
    onError,
  });
}

/** push never changes local tasks — nothing to invalidate on success. Errors are
 * read from the mutation's own `.error` by the sync panel (rejected → "pull first"
 * CTA, remote → credential guidance), in addition to the shared toast. */
export function usePushRepo(repo: string) {
  const onError = useApiErrorHandler();
  return useMutation({
    mutationFn: (remote?: string) => apiPost<PushJson>(`/repos/${encodeURIComponent(repo)}/push`, { remote }),
    onError,
  });
}

export function usePullRepo(repo: string) {
  const queryClient = useQueryClient();
  const onError = useApiErrorHandler();
  return useMutation({
    mutationFn: (remote?: string) => apiPost<PullJson>(`/repos/${encodeURIComponent(repo)}/pull`, { remote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", repo] });
      queryClient.invalidateQueries({ queryKey: ["tasksAll"] });
    },
    onError,
  });
}

export interface SyncAllInput {
  repos: string[];
  op: "push" | "pull";
  remote?: string;
}

export function useSyncAll() {
  const queryClient = useQueryClient();
  const onError = useApiErrorHandler();
  return useMutation({
    mutationFn: (input: SyncAllInput) => apiPost<SyncJson>("/sync", input),
    onSuccess: (result) => {
      if (!result || result.data.op !== "pull") return;
      queryClient.invalidateQueries({ queryKey: ["tasksAll"] });
      for (const item of result.data.results) {
        if (item.ok) queryClient.invalidateQueries({ queryKey: ["tasks", item.repo] });
      }
    },
    onError,
  });
}
