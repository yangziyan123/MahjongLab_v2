import { ArrowRightCircle, Bot, ListChecks } from "lucide-react";
import { useState } from "react";

import type { ReviewDetailCandidate, ReviewEntry } from "../../lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ReviewAssistantPanel } from "./ReviewAssistantPanel";

function formatAction(action?: Record<string, unknown> | null) {
  if (!action) {
    return "无动作";
  }
  const type = String(action.type ?? "unknown");
  const tile = typeof action.pai === "string" ? action.pai : "";
  if (type === "dahai") {
    return `打 ${tile}`;
  }
  if (type === "reach") {
    return "立直";
  }
  if (type === "none") {
    return "跳过";
  }
  return `${type}${tile ? ` ${tile}` : ""}`;
}

function CandidateList({
  candidates,
  entry,
}: {
  candidates: ReviewDetailCandidate[];
  entry: ReviewEntry;
}) {
  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="mb-1 flex items-center text-base font-semibold text-slate-900">
        <ArrowRightCircle className="mr-2 h-5 w-5" />
        候选动作
      </div>
      <p className="mb-4 text-sm leading-6 text-slate-500">
        Q 值越高，表示复盘引擎对该动作的局面评价越好。
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {candidates.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            当前步骤没有候选动作明细。
          </div>
        )}
        {candidates.map((candidate, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">候选 {index + 1}</div>
            <div className="mt-1 font-semibold text-slate-900">
              {formatAction(candidate.expected_action ?? entry.expected_action)}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              Q 值 {candidate.best_q_value ?? "-"} · 概率 {candidate.prob ?? "-"}
            </div>
          </div>
        ))}
      </div>
      {candidates.length === 1 && !entry.is_match && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">
          当前只保存了最佳候选，无法据此计算你的动作与推荐动作之间的精确价值差。
        </div>
      )}
    </div>
  );
}

export function ReviewDecisionAnalysisPanel({
  reviewId,
  entry,
  candidates,
}: {
  reviewId: string;
  entry: ReviewEntry;
  candidates: ReviewDetailCandidate[];
}) {
  const [activeTab, setActiveTab] = useState("candidates");
  return (
    <aside className="min-h-[560px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:h-full xl:min-h-0 xl:overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full min-h-0 gap-0">
        <TabsList className="mb-3 grid w-full shrink-0 grid-cols-2">
          <TabsTrigger value="candidates">
            <ListChecks className="h-4 w-4" />
            候选动作
          </TabsTrigger>
          <TabsTrigger value="assistant">
            <Bot className="h-4 w-4" />
            AI 讲解
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="candidates"
          forceMount
          hidden={activeTab !== "candidates"}
          className="min-h-0 overflow-hidden"
        >
          <CandidateList candidates={candidates} entry={entry} />
        </TabsContent>
        <TabsContent
          value="assistant"
          forceMount
          hidden={activeTab !== "assistant"}
          className="min-h-0 overflow-hidden"
        >
          <ReviewAssistantPanel reviewId={reviewId} entry={entry} active={activeTab === "assistant"} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
