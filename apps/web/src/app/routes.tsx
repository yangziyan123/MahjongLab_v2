import { createBrowserRouter } from "react-router";
import { Home } from "./pages/Home";
import { ReviewImport } from "./pages/review/ReviewImport";
import { ReviewTask } from "./pages/review/ReviewTask";
import { ReviewOpen } from "./pages/review/ReviewOpen";
import { ReviewReport } from "./pages/review/ReviewReport";
import { ReviewReplay } from "./pages/review/ReviewReplay";
import { ReviewHistory } from "./pages/review/ReviewHistory";
import { MistakeLibrary } from "./pages/training/MistakeLibrary";
import { PlayConfig } from "./pages/play/PlayConfig";
import { PlayGame } from "./pages/play/PlayGame";
import { PlayHistory } from "./pages/play/PlayHistory";
import { PlayResult } from "./pages/play/PlayResult";
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
    path: "/review/open/:reportId",
    Component: ReviewOpen,
  },
  {
    path: "/review/replay/:reportId",
    Component: ReviewReplay,
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
    path: "/training/mistakes",
    Component: MistakeLibrary,
  },
  {
    path: "/play/config",
    Component: PlayConfig,
  },
  {
    path: "/play/game/:roomId",
    Component: PlayGame,
  },
  {
    path: "/play/result/:sessionId",
    Component: PlayResult,
  },
  {
    path: "/play/history",
    Component: PlayHistory,
  },
  {
    path: "*",
    Component: NotFound,
  },
]);
