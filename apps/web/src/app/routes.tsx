import { lazy } from "react";
import { createBrowserRouter } from "react-router";

const Home = lazy(() => import("./pages/Home").then((module) => ({ default: module.Home })));
const ClassicLibrary = lazy(() =>
  import("./pages/classic/ClassicLibrary").then((module) => ({ default: module.ClassicLibrary })),
);
const ClassicTraining = lazy(() =>
  import("./pages/classic/ClassicTraining").then((module) => ({ default: module.ClassicTraining })),
);
const ReviewImport = lazy(() =>
  import("./pages/review/ReviewImport").then((module) => ({ default: module.ReviewImport })),
);
const ReviewTask = lazy(() =>
  import("./pages/review/ReviewTask").then((module) => ({ default: module.ReviewTask })),
);
const ReviewOpen = lazy(() =>
  import("./pages/review/ReviewOpen").then((module) => ({ default: module.ReviewOpen })),
);
const ReviewReport = lazy(() =>
  import("./pages/review/ReviewReport").then((module) => ({ default: module.ReviewReport })),
);
const ReviewReplay = lazy(() =>
  import("./pages/review/ReviewReplay").then((module) => ({ default: module.ReviewReplay })),
);
const ReviewHistory = lazy(() =>
  import("./pages/review/ReviewHistory").then((module) => ({ default: module.ReviewHistory })),
);
const PlayConfig = lazy(() =>
  import("./pages/play/PlayConfig").then((module) => ({ default: module.PlayConfig })),
);
const PlayGame = lazy(() =>
  import("./pages/play/PlayGame").then((module) => ({ default: module.PlayGame })),
);
const PlayHistory = lazy(() =>
  import("./pages/play/PlayHistory").then((module) => ({ default: module.PlayHistory })),
);
const PlayResult = lazy(() =>
  import("./pages/play/PlayResult").then((module) => ({ default: module.PlayResult })),
);
const NotFound = lazy(() =>
  import("./pages/NotFound").then((module) => ({ default: module.NotFound })),
);

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/classic",
    Component: ClassicLibrary,
  },
  {
    path: "/classic/train/:matchId",
    Component: ClassicTraining,
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
