import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { getDefaultView } from "./lib/defaultView";
import { Home } from "./pages/Home";
import { ProjectPage } from "./pages/ProjectPage";
import { RepoWorkspace } from "./pages/RepoWorkspace";
import { RepoBoardPage } from "./pages/RepoBoard";
import { RepoDevelopmentPage } from "./pages/RepoDevelopment";
import { RepoListPage } from "./pages/RepoList";
import { RepoMembersPage } from "./pages/RepoMembers";
import { RepoMilestonesPage } from "./pages/RepoMilestones";
import { RepoSyncPage } from "./pages/RepoSync";
import { RepoTablePage } from "./pages/RepoTable";
import { Settings } from "./pages/Settings";
import { TaskDialog } from "./pages/TaskDialog";
import { TaskPage } from "./pages/TaskPage";

function RepoIndexRedirect() {
  const { repo = "" } = useParams();
  return <Navigate to={`/r/${encodeURIComponent(repo)}/${getDefaultView()}`} replace />;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/settings", element: <Settings /> },
      { path: "/p/:project", element: <ProjectPage /> },
      {
        path: "/r/:repo",
        element: <RepoWorkspace />,
        children: [
          { index: true, element: <RepoIndexRedirect /> },
          {
            path: "board",
            element: <RepoBoardPage />,
            children: [{ path: "t/:displayId", element: <TaskDialog /> }],
          },
          {
            path: "list",
            element: <RepoListPage />,
            children: [{ path: "t/:displayId", element: <TaskDialog /> }],
          },
          {
            path: "table",
            element: <RepoTablePage />,
            children: [{ path: "t/:displayId", element: <TaskDialog /> }],
          },
          {
            path: "milestones",
            element: <RepoMilestonesPage />,
            children: [{ path: "t/:displayId", element: <TaskDialog /> }],
          },
          { path: "members", element: <RepoMembersPage /> },
          { path: "development", element: <RepoDevelopmentPage /> },
          { path: "sync", element: <RepoSyncPage /> },
        ],
      },
      { path: "/t/:repo/:displayId", element: <TaskPage /> },
    ],
  },
]);
