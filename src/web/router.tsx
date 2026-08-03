import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/shell/AppShell";
import { Home } from "./pages/Home";
import { ProjectPage } from "./pages/ProjectPage";
import { RepoWorkspace } from "./pages/RepoWorkspace";
import { RepoListPage } from "./pages/RepoList";
import { ComingSoon } from "./pages/ComingSoon";
import { TaskDrawer } from "./pages/TaskDrawer";
import { TaskPage } from "./pages/TaskPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/p/:project", element: <ProjectPage /> },
      {
        path: "/r/:repo",
        element: <RepoWorkspace />,
        children: [
          { path: "board", element: <ComingSoon view="Board" /> },
          {
            path: "list",
            element: <RepoListPage />,
            children: [{ path: "t/:displayId", element: <TaskDrawer /> }],
          },
          { path: "table", element: <ComingSoon view="Table" /> },
        ],
      },
      { path: "/t/:repo/:displayId", element: <TaskPage /> },
    ],
  },
]);
