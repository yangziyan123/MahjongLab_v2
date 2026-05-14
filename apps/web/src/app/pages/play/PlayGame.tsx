import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Download, Expand, FileSearch, LoaderCircle, Shrink } from "lucide-react";

import { ApiError, getPlayMatch, getPlayMatchExportUrl, getPlaySession, startPlayMatchReview } from "../../lib/api";
import type { PlayMatch, PlaySession } from "../../lib/types";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";

export function PlayGame() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialSession = (location.state as { session?: PlaySession } | null)?.session ?? null;
  const [session, setSession] = useState<PlaySession | null>(initialSession);
  const [match, setMatch] = useState<PlayMatch | null>(null);
  const [isLoading, setIsLoading] = useState(!initialSession);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canReviewNow, setCanReviewNow] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!session?.match_id) {
        throw new Error("match_id missing");
      }
      return startPlayMatchReview(session.match_id);
    },
    onSuccess: (job) => {
      if (job.review_id) {
        navigate(`/review/open/${job.review_id}`);
        return;
      }
      navigate(`/review/task/${job.id}`);
    },
  });

  useEffect(() => {
    if (initialSession) {
      return;
    }

    let cancelled = false;

    async function loadSession() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const latestSession = await getPlaySession();
        if (cancelled) {
          return;
        }
        if (!latestSession) {
          setErrorMessage("当前没有可用的对战会话，请先从入口页启动。");
          return;
        }
        setSession(latestSession);
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (error instanceof ApiError) {
          setErrorMessage(error.detail);
        } else {
          setErrorMessage("读取对战会话失败。");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [initialSession]);

  useEffect(() => {
    if (!session?.match_id) {
      return;
    }

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const latestMatch = await getPlayMatch(session.match_id);
        if (cancelled) {
          return;
        }
        setMatch(latestMatch);
        setCanReviewNow(
          latestMatch.reviewable_event_count > 0 &&
            (latestMatch.status === "round_finished" || latestMatch.status === "completed"),
        );
        if (latestMatch.status === "completed") {
          window.clearInterval(timer);
          navigate(`/play/result/${latestMatch.id}`);
        }
      } catch {
        // Polling failures should not interrupt the embedded game.
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [navigate, session?.match_id]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleExport = () => {
    if (!session?.match_id) {
      return;
    }
    window.open(getPlayMatchExportUrl(session.match_id), "_blank", "noopener,noreferrer");
  };

  const handleToggleFullscreen = async () => {
    try {
      if (!containerRef.current) {
        return;
      }
      if (document.fullscreenElement === containerRef.current) {
        await document.exitFullscreen();
        return;
      }
      await containerRef.current.requestFullscreen();
    } catch {
      // Browser fullscreen can fail when permission or focus state is not suitable.
    }
  };

  const reviewError =
    reviewMutation.error instanceof ApiError
      ? reviewMutation.error.detail
      : reviewMutation.error instanceof Error
      ? reviewMutation.error.message
      : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto h-screen w-full p-2">
        <div
          ref={containerRef}
          className="relative h-[calc(100vh-1rem)] overflow-hidden rounded-lg border border-slate-800 bg-black shadow-2xl"
        >
          <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm" className="bg-slate-900/85 text-white hover:bg-slate-800">
              <Link to="/play/config">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回入口
              </Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="bg-slate-900/85 text-white hover:bg-slate-800"
              onClick={() => void handleToggleFullscreen()}
            >
              {isFullscreen ? <Shrink className="mr-2 h-4 w-4" /> : <Expand className="mr-2 h-4 w-4" />}
              {isFullscreen ? "退出全屏" : "全屏"}
            </Button>
          </div>

          {roomId ? (
            <div className="absolute right-3 top-3 z-10 rounded-md bg-slate-900/85 px-3 py-2 text-xs text-slate-300">
              会话：{roomId}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="p-6 pt-20">
              <Alert variant="destructive">
                <AlertTitle>无法加载对战页</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  重试
                </Button>
                <Button asChild variant="outline" className="border-slate-700 bg-slate-900 text-white hover:bg-slate-800">
                  <Link to="/play/config">返回入口</Link>
                </Button>
              </div>
            </div>
          ) : isLoading || !session ? (
            <div className="flex h-full min-h-[75vh] items-center justify-center text-slate-300">
              <div className="flex items-center gap-3">
                <LoaderCircle className="h-5 w-5 animate-spin" />
                <span>正在准备 Mahjong-AI 对战页面...</span>
              </div>
            </div>
          ) : (
            <iframe
              title="Mahjong-AI Game"
              src={session.launch_url}
              className="h-full w-full border-0"
              allow="fullscreen"
              allowFullScreen
            />
          )}

          {session && canReviewNow ? (
            <div className="absolute bottom-3 right-3 z-10 w-[min(100%-1.5rem,360px)] rounded-lg border border-slate-700 bg-slate-900/90 p-3 shadow-xl backdrop-blur">
              <div className="mb-2 text-sm text-slate-200">
                {match?.status === "completed" ? "当前对局已结束" : "当前小局已结束"}
              </div>
              {reviewError ? <div className="mb-2 text-xs text-red-300">{reviewError}</div> : null}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
                  {reviewMutation.isPending ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSearch className="mr-2 h-4 w-4" />
                  )}
                  立即复盘
                </Button>
                <Button size="sm" variant="outline" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" />
                  导出数据
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
