import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiPatch, apiPost, apiPut, ApiError, type ApiSuccess } from "./api";
import { queryKeys } from "./queryKeys";
import { useIdentityDialog } from "../components/identity/IdentityDialogContext";
import type { DropJson, LinkKind, LsJson, MutationJson, Priority, TaskJson, TaskKind } from "../../shared/contract";

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

/** Shared by every mutation hook below. `onError`: identity_missing (§3.2) opens the
 * dedicated dialog instead of a toast — the terminal command it needs isn't
 * actionable from a toast. `applyTask`: pushes the mutation's returned task straight
 * into the task-detail cache (drawer/full page reflect the write with no refetch
 * round-trip) and invalidates every list/board/table query for the repo so the card
 * behind it updates too. */
function useMutationEffects(repo: string) {
  const queryClient = useQueryClient();
  const identityDialog = useIdentityDialog();

  function onError(error: unknown) {
    if (error instanceof ApiError && error.kind === "identity_missing") {
      identityDialog.open(error);
      return;
    }
    toast.error(error instanceof Error ? error.message : "Request failed");
  }

  function applyTask(task: TaskJson) {
    queryClient.setQueryData(queryKeys.task(repo, task.display_id), { data: task, warnings: [] });
    queryClient.invalidateQueries({ queryKey: ["tasks", repo] });
    queryClient.invalidateQueries({ queryKey: ["tasksAll"] });
  }

  return { onError, applyTask, queryClient };
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
    mutationFn: ({ kind, target }: { kind: LinkKind; target: string }) =>
      apiPost<MutationJson>(taskPath(repo, id, "/links"), { kind, target }),
    onSuccess: (result) => {
      if (result) applyTask(result.data.task);
    },
    onError,
  });
}

export function useRemoveLink(repo: string, id: string) {
  const { onError, applyTask } = useMutationEffects(repo);
  return useMutation({
    mutationFn: ({ kind, target }: { kind: LinkKind; target: string }) =>
      apiDelete<MutationJson>(taskPath(repo, id, `/links/${kind}/${encodeURIComponent(target)}`)),
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
