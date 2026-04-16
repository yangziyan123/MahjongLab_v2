import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Progress } from "../../components/ui/progress";
import { ArrowLeft, CheckCircle, Loader2, XCircle } from "lucide-react";

type TaskStatus = "parsing" | "queued" | "analyzing" | "completed" | "failed";

export function ReviewTask() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<TaskStatus>("parsing");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 模拟任务进度
    const statuses: TaskStatus[] = ["parsing", "queued", "analyzing", "completed"];
    let currentIndex = 0;
    let currentProgress = 0;

    const interval = setInterval(() => {
      if (currentIndex < statuses.length - 1) {
        currentProgress += 10;
        setProgress(currentProgress);

        if (currentProgress >= (currentIndex + 1) * 25) {
          currentIndex++;
          setStatus(statuses[currentIndex]);
        }
      } else if (currentProgress < 100) {
        currentProgress += 5;
        setProgress(Math.min(currentProgress, 100));
      } else {
        clearInterval(interval);
        // 自动跳转到报告页
        setTimeout(() => {
          navigate(`/review/report/report-${taskId}`);
        }, 1000);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [taskId, navigate]);

  const getStatusInfo = () => {
    switch (status) {
      case "parsing":
        return {
          icon: <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />,
          title: "解析中",
          description: "正在解析牌谱数据...",
        };
      case "queued":
        return {
          icon: <Loader2 className="w-12 h-12 text-yellow-600 animate-pulse" />,
          title: "排队中",
          description: "等待 AI 引擎处理...",
        };
      case "analyzing":
        return {
          icon: <Loader2 className="w-12 h-12 text-green-600 animate-spin" />,
          title: "分析中",
          description: "AI 正在分析对局决策...",
        };
      case "completed":
        return {
          icon: <CheckCircle className="w-12 h-12 text-green-600" />,
          title: "完成",
          description: "复盘报告已生成",
        };
      case "failed":
        return {
          icon: <XCircle className="w-12 h-12 text-red-600" />,
          title: "失败",
          description: "任务执行失败，请稍后重试",
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center">
          <Link to="/review/import">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回导入页
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 ml-4">任务状态</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>任务 ID: {taskId}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="flex justify-center mb-6">
                  {statusInfo.icon}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  {statusInfo.title}
                </h2>
                <p className="text-slate-600 mb-8">
                  {statusInfo.description}
                </p>

                {/* Progress Bar */}
                {status !== "failed" && (
                  <div className="mb-8">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-slate-500 mt-2">
                      {progress}% 完成
                    </p>
                  </div>
                )}

                {/* Status Steps */}
                <div className="flex justify-between items-center mb-8 px-8">
                  {["parsing", "queued", "analyzing", "completed"].map((s, index) => {
                    const isActive = ["parsing", "queued", "analyzing", "completed"].indexOf(status) >= index;
                    const labels = ["解析", "排队", "分析", "完成"];
                    return (
                      <div key={s} className="flex flex-col items-center flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            isActive ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <span className="text-xs text-slate-600 mt-2">{labels[index]}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                {status === "completed" && (
                  <Link to={`/review/report/report-${taskId}`}>
                    <Button size="lg">
                      查看报告
                    </Button>
                  </Link>
                )}

                {status === "failed" && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-left">
                      <p className="font-semibold text-red-900 mb-1">错误原因：</p>
                      <p className="text-red-700">
                        牌谱格式不合法或数据损坏，请检查后重新导入
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <Link to="/review/import" className="flex-1">
                        <Button className="w-full">
                          重新导入
                        </Button>
                      </Link>
                      <Link to="/" className="flex-1">
                        <Button variant="outline" className="w-full">
                          返回首页
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Task Info */}
              <div className="border-t pt-6 mt-6">
                <h3 className="font-semibold text-slate-900 mb-4">任务信息</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">创建时间：</span>
                    <span className="text-slate-900">2026-03-29 14:30:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">目标玩家：</span>
                    <span className="text-slate-900">玩家1</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">局数：</span>
                    <span className="text-slate-900">全部局</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">AI 引擎：</span>
                    <span className="text-slate-900">标准引擎 v1.0</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
