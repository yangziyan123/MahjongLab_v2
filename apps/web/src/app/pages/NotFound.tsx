import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { AlertCircle } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center px-4">
        <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-slate-700 mb-4">
          页面未找到
        </h2>
        <p className="text-slate-600 mb-8">
          抱歉，您访问的页面不存在或已被移除
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/">
            <Button size="lg">
              返回首页
            </Button>
          </Link>
          <Link to="/review/import">
            <Button variant="outline" size="lg">
              AI 复盘
            </Button>
          </Link>
          <Link to="/play/config">
            <Button variant="outline" size="lg">
              AI 对战
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
