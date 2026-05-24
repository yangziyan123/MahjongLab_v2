import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, FileJson, Hash, Link as LinkIcon, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";

import { ApiError, createReviewJob, listReplaySources, listReviews, uploadReplayFile } from "../../lib/api";
import { formatDateTime, formatRelativeSize } from "../../lib/format";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";

type ImportType = "tenhou" | "majsoul" | "file" | "json";
type TenhouImportType = "link" | "id";
type MajsoulImportType = "file" | "url";

function normalizeInlineJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("请先输入 JSON 内容。");
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return { events: parsed };
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown[] }).events)) {
      return { events: (parsed as { events: unknown[] }).events };
    }
    throw new Error("JSON 需要是事件数组，或包含 events 数组的对象。");
  } catch (error) {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 1) {
      lines.forEach((line) => JSON.parse(line));
      return { jsonl: lines.join("\n") };
    }
    throw error instanceof Error ? error : new Error("无法解析 JSON 内容。");
  }
}

export function ReviewImport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [importType, setImportType] = useState<ImportType>("file");
  const [tenhouImportType, setTenhouImportType] = useState<TenhouImportType>("link");
  const [majsoulImportType, setMajsoulImportType] = useState<MajsoulImportType>("file");
  const [selectedPlayer, setSelectedPlayer] = useState("auto");
  const [language, setLanguage] = useState("zh-CN");
  const [outputFormat, setOutputFormat] = useState("json");
  const [anonymous, setAnonymous] = useState(false);
  const [tenhouUrl, setTenhouUrl] = useState("");
  const [tenhouId, setTenhouId] = useState("");
  const [majsoulUrl, setMajsoulUrl] = useState("");
  const [jsonContent, setJsonContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [majsoulFile, setMajsoulFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ["replay-sources"],
    queryFn: listReplaySources,
  });
  const recentReviewsQuery = useQuery({
    queryKey: ["recent-reviews"],
    queryFn: () => listReviews({ page: 1, page_size: 3 }),
  });

  const enabledSources = useMemo(
    () => new Set((sourcesQuery.data ?? []).filter((item) => item.enabled).map((item) => item.key)),
    [sourcesQuery.data],
  );

  useEffect(() => {
    if (tenhouImportType === "link" && !enabledSources.has("tenhou_url") && enabledSources.has("tenhou_id")) {
      setTenhouImportType("id");
      return;
    }

    if (tenhouImportType === "id" && !enabledSources.has("tenhou_id") && enabledSources.has("tenhou_url")) {
      setTenhouImportType("link");
    }
  }, [enabledSources, tenhouImportType]);

  useEffect(() => {
    if (majsoulImportType === "file" && !enabledSources.has("majsoul_file") && enabledSources.has("majsoul_url")) {
      setMajsoulImportType("url");
      return;
    }

    if (majsoulImportType === "url" && !enabledSources.has("majsoul_url") && enabledSources.has("majsoul_file")) {
      setMajsoulImportType("file");
    }
  }, [enabledSources, majsoulImportType]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const options = {
        lang: language,
        output_format: outputFormat,
        anonymous,
      };
      const targetPlayerRef = selectedPlayer === "auto" ? undefined : selectedPlayer;

      if (importType === "tenhou") {
        if (tenhouImportType === "link") {
          if (!enabledSources.has("tenhou_url")) {
            throw new Error("所选导入方式暂不可用。");
          }
          if (!tenhouUrl.trim()) {
            throw new Error("请输入 Tenhou 牌谱链接。");
          }
          return createReviewJob({
            source_type: "tenhou_url",
            platform: "tenhou",
            source: { url: tenhouUrl.trim() },
            options,
            target_player_ref: targetPlayerRef,
          });
        }

        if (!enabledSources.has("tenhou_id")) {
          throw new Error("所选导入方式暂不可用。");
        }
        if (!tenhouId.trim()) {
          throw new Error("请输入 Tenhou 对局 ID。");
        }
        return createReviewJob({
          source_type: "tenhou_id",
          platform: "tenhou",
          source: { id: tenhouId.trim() },
          options,
          target_player_ref: targetPlayerRef,
        });
      }

      if (importType === "file") {
        if (!selectedFile) {
          throw new Error("请先选择要上传的牌谱文件。");
        }
        const upload = await uploadReplayFile(selectedFile);
        return createReviewJob({
          source_type: "upload_file",
          platform: "internal",
          source: { file_key: upload.file_key },
          options,
          target_player_ref: targetPlayerRef,
        });
      }

      if (importType === "majsoul") {
        if (selectedPlayer === "auto") {
          throw new Error("雀魂导入暂不支持自动识别目标玩家，请手动选择玩家座位。");
        }

        if (majsoulImportType === "url") {
          if (!enabledSources.has("majsoul_url")) {
            throw new Error("所选导入方式暂不可用。");
          }
          if (!majsoulUrl.trim()) {
            throw new Error("请输入雀魂牌谱链接。");
          }
          return createReviewJob({
            source_type: "majsoul_url",
            platform: "majsoul",
            source: { url: majsoulUrl.trim() },
            options,
            target_player_ref: selectedPlayer,
          });
        }

        if (!enabledSources.has("majsoul_file")) {
          throw new Error("所选导入方式暂不可用。");
        }
        if (!majsoulFile) {
          throw new Error("请先选择雀魂导出文件。");
        }
        const upload = await uploadReplayFile(majsoulFile);
        return createReviewJob({
          source_type: "majsoul_file",
          platform: "majsoul",
          source: { file_key: upload.file_key },
          options,
          target_player_ref: selectedPlayer,
        });
      }

      if (importType === "json") {
        const source = normalizeInlineJson(jsonContent);
        return createReviewJob({
          source_type: "inline_json",
          platform: "internal",
          source,
          options,
          target_player_ref: targetPlayerRef,
        });
      }

      throw new Error("不支持的导入方式。");
    },
    onSuccess: async (job) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recent-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["review-jobs"] }),
      ]);
      navigate(`/review/task/${job.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        setErrorMessage(error.detail);
        return;
      }
      if (error instanceof Error) {
        setErrorMessage(error.message);
        return;
      }
      setErrorMessage("创建复盘任务失败。");
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    createMutation.mutate();
  };

  const recentReviews = recentReviewsQuery.data?.items ?? [];
  const isMajsoulImport = importType === "majsoul";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white shadow-sm">
        <div className="container mx-auto flex items-center px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Button>
          </Link>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-slate-900">AI 复盘</h1>
            <p className="text-sm text-slate-500">导入牌谱，生成可筛选、可回放的复盘结果。</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>导入牌谱</CardTitle>
              <CardDescription>支持 Tenhou（链接 / ID）、Majsoul（导出文件 / 链接）、mjai 文件和 JSON 导入。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs value={importType} onValueChange={(value) => setImportType(value as ImportType)}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="tenhou">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Tenhou
                    </TabsTrigger>
                    <TabsTrigger value="majsoul">
                      <Download className="mr-2 h-4 w-4" />
                      雀魂
                    </TabsTrigger>
                    <TabsTrigger value="file">
                      <Upload className="mr-2 h-4 w-4" />
                      文件
                    </TabsTrigger>
                    <TabsTrigger value="json">
                      <FileJson className="mr-2 h-4 w-4" />
                      JSON
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tenhou" className="space-y-4">
                    <Tabs
                      value={tenhouImportType}
                      onValueChange={(value) => setTenhouImportType(value as TenhouImportType)}
                      className="gap-4"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="link" disabled={!enabledSources.has("tenhou_url")}>
                          <LinkIcon className="mr-2 h-4 w-4" />
                          链接
                        </TabsTrigger>
                        <TabsTrigger value="id" disabled={!enabledSources.has("tenhou_id")}>
                          <Hash className="mr-2 h-4 w-4" />
                          ID
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="link" className="space-y-4">
                        <div>
                          <Label htmlFor="tenhou-link">Tenhou 牌谱链接</Label>
                          <Input
                            id="tenhou-link"
                            placeholder="https://tenhou.net/0/?log=...&tw=2"
                            className="mt-2"
                            value={tenhouUrl}
                            onChange={(event) => setTenhouUrl(event.target.value)}
                          />
                          <p className="mt-2 text-sm text-slate-500">
                            支持直接粘贴 Tenhou 牌谱链接；如果链接中包含 `tw`，会自动识别目标玩家。
                          </p>
                        </div>
                      </TabsContent>

                      <TabsContent value="id" className="space-y-4">
                        <div>
                          <Label htmlFor="tenhou-id">Tenhou 对局 ID</Label>
                          <Input
                            id="tenhou-id"
                            placeholder="2019050417gm-0029-0000-4f2a8622"
                            className="mt-2"
                            value={tenhouId}
                            onChange={(event) => setTenhouId(event.target.value)}
                          />
                          <p className="mt-2 text-sm text-slate-500">输入 Tenhou 对局 ID 后即可直接创建复盘任务。</p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="majsoul" className="space-y-4">
                    <Tabs
                      value={majsoulImportType}
                      onValueChange={(value) => setMajsoulImportType(value as MajsoulImportType)}
                      className="gap-4"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="file" disabled={!enabledSources.has("majsoul_file")}>
                          <Download className="mr-2 h-4 w-4" />
                          导出文件
                        </TabsTrigger>
                        <TabsTrigger value="url" disabled={!enabledSources.has("majsoul_url")}>
                          <LinkIcon className="mr-2 h-4 w-4" />
                          链接
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="file" className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-white p-3 shadow-sm">
                              <Download className="h-6 w-6 text-slate-600" />
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <Label htmlFor="majsoul-file">雀魂导出文件</Label>
                                <Input
                                  id="majsoul-file"
                                  type="file"
                                  className="mt-2"
                                  onChange={(event) => setMajsoulFile(event.target.files?.[0] ?? null)}
                                />
                              </div>
                              <p className="text-sm text-slate-500">
                                当前支持上传通过浏览器脚本或 Majsoul+ “Save logs” 导出的对局文件，再由后端转换为 `mjai`。
                              </p>
                              <p className="text-sm text-amber-700">这个入口需要明确选择目标玩家座位，不能自动识别。</p>
                              {majsoulFile && (
                                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                                  已选择：
                                  <span className="ml-2 font-semibold text-slate-900">{majsoulFile.name}</span>
                                  <span className="ml-2 text-slate-500">{formatRelativeSize(majsoulFile.size)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="url" className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                          <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-white p-3 shadow-sm">
                              <LinkIcon className="h-6 w-6 text-slate-600" />
                            </div>
                            <div className="flex-1 space-y-3">
                              <div>
                                <Label htmlFor="majsoul-url">雀魂牌谱链接</Label>
                                <Input
                                  id="majsoul-url"
                                  placeholder="https://game.maj-soul.com/1/?paipu=..."
                                  className="mt-2"
                                  value={majsoulUrl}
                                  onChange={(event) => setMajsoulUrl(event.target.value)}
                                />
                              </div>
                              <p className="text-sm text-slate-500">
                                需要粘贴带 `paipu` 参数的雀魂回放页面链接。后端会复用你本机已登录的 Chrome / Edge 会话抓取牌谱，再转换为 `mjai`。
                              </p>
                              <p className="text-sm text-amber-700">这个入口同样需要手动指定目标玩家座位，当前不会自动识别。</p>
                            </div>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-white p-3 shadow-sm">
                          <Upload className="h-6 w-6 text-slate-600" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div>
                            <Label htmlFor="review-file">牌谱文件</Label>
                            <Input
                              id="review-file"
                              type="file"
                              className="mt-2"
                              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                            />
                          </div>
                          <p className="text-sm text-slate-500">
                            当前推荐上传平台内导出的 `mjai` JSON / JSONL 文件，或其他已经标准化的 `mjai` 事件文件。
                          </p>
                          {selectedFile && (
                            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                              已选择：
                              <span className="ml-2 font-semibold text-slate-900">{selectedFile.name}</span>
                              <span className="ml-2 text-slate-500">{formatRelativeSize(selectedFile.size)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="json" className="space-y-4">
                    <div>
                      <Label htmlFor="json">JSON 或 JSONL 数据</Label>
                      <Textarea
                        id="json"
                        className="mt-2 min-h-[260px] font-mono text-sm"
                        placeholder='[{"type":"start_kyoku", ...}, {"type":"tsumo", ...}]'
                        value={jsonContent}
                        onChange={(event) => setJsonContent(event.target.value)}
                      />
                      <p className="mt-2 text-sm text-slate-500">支持 `mjai` 事件数组，或逐行 JSON 的 `JSONL`。</p>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="grid gap-6 border-t pt-6 md:grid-cols-2">
                  <div>
                    <Label htmlFor="player">目标玩家</Label>
                    <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">自动识别</SelectItem>
                        <SelectItem value="0">玩家 0</SelectItem>
                        <SelectItem value="1">玩家 1</SelectItem>
                        <SelectItem value="2">玩家 2</SelectItem>
                        <SelectItem value="3">玩家 3</SelectItem>
                      </SelectContent>
                    </Select>
                    {isMajsoulImport && (
                      <p className="mt-2 text-sm text-amber-700">雀魂导入必须手动指定目标玩家座位。</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="language">语言</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="zh-CN">简体中文</SelectItem>
                        <SelectItem value="ja-JP">日本語</SelectItem>
                        <SelectItem value="en-US">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="output">输出格式</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON 数据</SelectItem>
                        <SelectItem value="html">HTML 报告</SelectItem>
                        <SelectItem value="both">两者都要</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <div className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                      <Checkbox
                        id="anonymous"
                        checked={anonymous}
                        onCheckedChange={(checked) => setAnonymous(Boolean(checked))}
                      />
                      <Label htmlFor="anonymous" className="cursor-pointer">
                        匿名化处理
                      </Label>
                    </div>
                  </div>
                </div>

                {errorMessage && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}

                <div className="flex gap-4">
                  <Button type="submit" className="flex-1" size="lg" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "正在创建任务..." : "创建复盘任务"}
                  </Button>
                  <Link to="/" className="flex-1">
                    <Button type="button" variant="outline" className="w-full" size="lg">
                      取消
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>最近生成的报告</CardTitle>
              <CardDescription>这些记录来自真实后端，可直接跳转查看。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentReviews.length === 0 && (
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  暂无历史报告，创建第一份任务后这里会出现最近记录。
                </div>
              )}
              {recentReviews.map((review) => (
                <Link
                  key={review.id}
                  to={`/review/open/${review.id}`}
                  className="block rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {review.target_player_label || `玩家 ${review.target_actor}`}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{formatDateTime(review.created_at)}</div>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <div>{review.reviewed_decision_count} 个决策点</div>
                      <div>{review.high_deviation_count} 处高偏差</div>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
