import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { Home } from "./pages/Home";
import { ProjectPage } from "./pages/ProjectPage";
import { RepoWorkspace } from "./pages/RepoWorkspace";
import { RepoBoardPage } from "./pages/RepoBoard";
import { RepoListPage } from "./pages/RepoList";
import { RepoSyncPage } from "./pages/RepoSync";
import { RepoTablePage } from "./pages/RepoTable";
import { Settings } from "./pages/Settings";
import { TaskDialog } from "./pages/TaskDialog";
import { TaskPage } from "./pages/TaskPage";

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
          { path: "sync", element: <RepoSyncPage /> },
        ],
      },
      { path: "/t/:repo/:displayId", element: <TaskPage /> },
    ],
  },
]);
