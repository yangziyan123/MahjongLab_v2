import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { AlertCircle } from "lucide-react";

export function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <h1 className="mb-2 text-5xl font-bold text-slate-900">404</h1>
        <h2 className="mb-3 text-xl font-semibold text-slate-800">页面未找到</h2>
        <p className="mb-8 text-slate-600">这个地址不存在，或对应页面已经被移动。</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button asChild size="lg">
            <Link to="/">返回首页</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/review/import">AI 复盘</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/play/config">AI 对战</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
