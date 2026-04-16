import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { getReviewJob, retryReviewJob } from "../../lib/api";
import { formatDateTime, formatPlatform, formatSourceType } from "../../lib/format";
import type { ReviewJobStatus } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";

function getStatusInfo(status: ReviewJobStatus) {
  if (status === "parsing") {
    return {
      icon: <Loader2 className="h-12 w-12 animate-spin text-blue-600" />,
      title: "解析中",
      description: "正在读取输入牌谱并标准化事件流。",
    };
  }
  if (status === "queued") {
    return {
      icon: <Loader2 className="h-12 w-12 animate-pulse text-amber-600" />,
      title: "排队中",
      description: "任务已创建，等待复盘执行器开始分析。",
    };
  }
  if (status === "analyzing") {
    return {
      icon: <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />,
      title: "分析中",
      description: "Mortal review mode 正在生成结构化复盘结果。",
    };
  }
  if (status === "completed") {
    return {
      icon: <CheckCircle className="h-12 w-12 text-emerald-600" />,
      title: "已完成",
      description: "复盘报告已经生成，可直接进入详情页。",
    };
  }
  return {
    icon: <XCircle className="h-12 w-12 text-red-600" />,
    title: "任务失败",
    description: "这次复盘没有成功完成，可以查看错误信息并尝试重试。",
  };
}

export function ReviewTask() {
  const { taskId = "" } = useParams();
  const navigate = useNavigate();

  const jobQuery = useQuery({
    queryKey: ["review-job", taskId],
    queryFn: () => getReviewJob(taskId),
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1500;
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => retryReviewJob(taskId),
    onSuccess: () => {
      void jobQuery.refetch();
    },
  });

  useEffect(() => {
    if (!jobQuery.data?.review_id || jobQuery.data.status !== "completed") {
      return;
    }
    const timer = window.setTimeout(() => {
      navigate(`/review/report/${jobQuery.data?.review_id}`);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [jobQuery.data?.review_id, jobQuery.data?.status, navigate]);

  if (jobQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  if (jobQuery.isError || !jobQuery.data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b bg-white shadow-sm">
          <div className="container mx-auto flex items-center px-4 py-4">
            <Link to="/review/import">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回导入页
              </Button>
            </Link>
            <h1 className="ml-4 text-2xl font-bold text-slate-900">任务状态</h1>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="mx-auto max-w-2xl">
            <Card>
              <CardContent className="py-12 text-center text-red-600">
                无法读取任务状态，请检查 `taskId` 是否正确。
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  const job = jobQuery.data;
  const statusInfo = getStatusInfo(job.status);
  const currentStepIndex = ["parsing", "queued", "analyzing", "completed"].indexOf(
    job.status === "failed" ? "analyzing" : job.status,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex items-center px-4 py-4">
          <Link to="/review/import">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回导入页
            </Button>
          </Link>
          <h1 className="ml-4 text-2xl font-bold text-slate-900">任务状态</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>任务 ID: {taskId}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="py-4 text-center">
                <div className="mb-6 flex justify-center">{statusInfo.icon}</div>
                <h2 className="mb-2 text-2xl font-bold text-slate-900">{statusInfo.title}</h2>
                <p className="mb-8 text-slate-600">{statusInfo.description}</p>

                {job.status !== "failed" && (
                  <div className="mb-8">
                    <Progress value={job.progress} className="h-2" />
                    <p className="mt-2 text-sm text-slate-500">{job.progress}% 完成</p>
                  </div>
                )}

                <div className="mb-8 flex items-center justify-between gap-2 px-2 md:px-12">
                  {["解析", "排队", "分析", "完成"].map((label, index) => {
                    const active = currentStepIndex >= index || job.status === "completed";
                    return (
                      <div key={label} className="flex flex-1 flex-col items-center">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                            active ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span className="mt-2 text-xs text-slate-600">{label}</span>
                      </div>
                    );
                  })}
                </div>

                {job.status === "completed" && job.review_id && (
                  <div className="flex gap-4">
                    <Link to={`/review/report/${job.review_id}`} className="flex-1">
                      <Button size="lg" className="w-full">
                        查看报告
                      </Button>
                    </Link>
                    <Link to="/review/history" className="flex-1">
                      <Button size="lg" variant="outline" className="w-full">
                        查看历史
                      </Button>
                    </Link>
                  </div>
                )}

                {job.status === "failed" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700">
                      <p className="mb-1 font-semibold text-red-900">错误信息</p>
                      <p>{job.error_message || "后端没有返回更详细的错误原因。"}</p>
                    </div>
                    <div className="flex gap-4">
                      <Button
                        className="flex-1"
                        onClick={() => retryMutation.mutate()}
                        disabled={retryMutation.isPending}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {retryMutation.isPending ? "正在重试..." : "重试任务"}
                      </Button>
                      <Link to="/review/import" className="flex-1">
                        <Button variant="outline" className="w-full">
                          返回导入页
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>任务信息</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">创建时间</span>
                <span className="font-medium text-slate-900">{formatDateTime(job.created_at)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">更新时间</span>
                <span className="font-medium text-slate-900">{formatDateTime(job.updated_at)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">来源类型</span>
                <span className="font-medium text-slate-900">{formatSourceType(job.source_type)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">平台</span>
                <span className="font-medium text-slate-900">{formatPlatform(job.platform)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">目标玩家</span>
                <span className="font-medium text-slate-900">
                  {job.target_player_ref ?? (job.target_actor !== null ? String(job.target_actor) : "-")}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">重试次数</span>
                <span className="font-medium text-slate-900">{job.attempt_count}</span>
              </div>
              <div className="flex justify-between gap-4 md:col-span-2">
                <span className="text-slate-500">后端步骤</span>
                <span className="font-medium text-slate-900">{job.step}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
