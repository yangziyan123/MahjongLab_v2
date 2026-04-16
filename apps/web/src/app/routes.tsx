import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { ReviewImport } from "./pages/review/ReviewImport";
import { ReviewTask } from "./pages/review/ReviewTask";
import { ReviewReport } from "./pages/review/ReviewReport";
import { ReviewHistory } from "./pages/review/ReviewHistory";
import { PlayComingSoon } from "./pages/play/PlayComingSoon";
import { NotFound } from "./pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/review/import",
    Component: ReviewImport,
  },
  {
    path: "/review/task/:taskId",
    Component: ReviewTask,
  },
  {
    path: "/review/report/:reportId",
    Component: ReviewReport,
  },
  {
    path: "/review/history",
    Component: ReviewHistory,
  },
  {
    path: "/play/config",
    Component: PlayComingSoon,
  },
  {
    path: "/play/game/:roomId",
    Component: PlayComingSoon,
  },
  {
    path: "/play/result/:sessionId",
    Component: PlayComingSoon,
  },
  {
    path: "/play/history",
    Component: PlayComingSoon,
  },
  {
    path: "*",
    Component: NotFound,
  },
]);
