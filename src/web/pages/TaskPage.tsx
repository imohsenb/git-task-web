import { useParams } from "react-router-dom";
import { Breadcrumb } from "../components/shell/Breadcrumb";
import { TaskDetail } from "../components/task/TaskDetail";
import { useTask } from "../lib/queries";

export function TaskPage() {
  const { repo = "", displayId = "" } = useParams();
  const { data, isLoading, error } = useTask(repo, displayId);

  return (
    <div className="max-w-6xl px-8 py-6">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: repo, to: `/r/${encodeURIComponent(repo)}` },
          { label: displayId },
        ]}
      />
      <div className="mt-6">
        {isLoading && <p className="text-sm text-ink-4">Loading…</p>}
        {error && <p className="text-sm text-danger-ink">{error.message}</p>}
        {data && <TaskDetail repo={repo} task={data.data} />}
      </div>
    </div>
  );
}
