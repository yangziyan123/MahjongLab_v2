import type { PlayMatch, ReviewJobStatus } from "./types";

export interface PlayScoreRow {
  actor: number;
  name: string;
  isAi: boolean;
  isPlayer: boolean;
  score?: number;
  delta?: number;
  rank?: number;
}

interface AgentSource {
  actor?: unknown;
  username?: unknown;
  is_ai?: unknown;
  score?: unknown;
}

interface AiOpponentSource {
  style?: unknown;
  difficulty?: unknown;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function normalizePoints(value: unknown) {
  const points = Number(value);
  if (!Number.isFinite(points)) {
    return undefined;
  }
  return Math.abs(points) <= 1000 ? points * 100 : points;
}

function getSourceText(match: PlayMatch, key: string) {
  return asString(match.source?.[key]);
}

function getAgentSources(match: PlayMatch): AgentSource[] {
  const agents = match.source?.agents;
  if (!Array.isArray(agents)) {
    return [];
  }
  return agents.filter((agent): agent is AgentSource => typeof agent === "object" && agent !== null);
}

function getAiOpponentSources(match: PlayMatch): AiOpponentSource[] {
  const opponents = match.source?.ai_opponents;
  if (!Array.isArray(opponents)) {
    return [];
  }
  return opponents.filter((opponent): opponent is AiOpponentSource => typeof opponent === "object" && opponent !== null);
}

function normalizeAiDifficulty(value: unknown) {
  return value === "hard" || value === "normal" ? value : undefined;
}

function stripAiDifficultySuffix(name: string) {
  return name.replace(/\s*[（(](?:简单|普通|进阶|困难|normal|hard)[）)]\s*$/i, "");
}

function aiConfigIndexFromName(name?: string) {
  if (!name) {
    return undefined;
  }
  const match = name.match(/(?:一姬|AI\s*对手)\s*(\d+)/i);
  if (!match) {
    return undefined;
  }
  const index = Number(match[1]) - 1;
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

function getAiDisplayName(match: PlayMatch, username: string | undefined, aiOrderIndex: number) {
  const fallbackName = username || `AI 对手 ${aiOrderIndex + 1}`;
  const baseName = stripAiDifficultySuffix(fallbackName);
  const opponents = getAiOpponentSources(match);
  const configIndex = aiConfigIndexFromName(username) ?? aiOrderIndex;
  const configuredDifficulty = normalizeAiDifficulty(opponents[configIndex]?.difficulty);
  const launchDifficulty = normalizeAiDifficulty(match.source?.ai_level);
  const difficulty = configuredDifficulty ?? launchDifficulty;

  if (!difficulty) {
    return baseName;
  }
  return `${baseName}（${formatAiLevel(difficulty)}）`;
}

function scoreMapFromResult(match: PlayMatch) {
  const scoreMap = new Map<number, number>();
  const score = match.result?.score;
  if (!Array.isArray(score)) {
    return scoreMap;
  }

  score.forEach((item, index) => {
    if (Array.isArray(item) && item.length >= 2) {
      const actor = Number(item[0]);
      const points = normalizePoints(item[1]);
      if (Number.isInteger(actor) && actor >= 0 && points !== undefined) {
        scoreMap.set(actor, points);
      }
      return;
    }

    if (typeof item === "object" && item !== null) {
      const payload = item as Record<string, unknown>;
      const actor = Number(payload.actor ?? payload.who ?? index);
      const points = normalizePoints(payload.score ?? payload.points);
      if (Number.isInteger(actor) && actor >= 0 && points !== undefined) {
        scoreMap.set(actor, points);
      }
      return;
    }

    const points = normalizePoints(item);
    if (points !== undefined) {
      scoreMap.set(index, points);
    }
  });

  return scoreMap;
}

export function formatAiLevel(level?: unknown) {
  if (level === "hard") {
    return "进阶";
  }
  if (level === "normal") {
    return "普通";
  }
  return "未记录";
}

export function formatMatchStatus(status: string) {
  const labels: Record<string, string> = {
    created: "已创建",
    running: "小局已结算",
    round_finished: "小局已结算",
    completed: "已完成",
    failed: "失败",
  };
  return labels[status] ?? status;
}

export function formatTrainingHistoryStatus(status: string) {
  if (status === "running") {
    return "小局已结算";
  }
  return formatMatchStatus(status);
}

export function formatMatchType(type?: string | null) {
  if (type === "tonpu") {
    return "东风战";
  }
  if (type === "hanchan") {
    return "半庄战";
  }
  return "标准规则";
}

export function formatReviewJobStatus(status: ReviewJobStatus | string) {
  const labels: Record<string, string> = {
    created: "已创建",
    queued: "排队中",
    parsing: "解析中",
    analyzing: "分析中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return labels[status] ?? status;
}

export function formatSignedPoints(value?: number) {
  if (value === undefined) {
    return "-";
  }
  if (value > 0) {
    return `+${value.toLocaleString()}`;
  }
  return value.toLocaleString();
}

export function getPlayerActor(match: PlayMatch) {
  if (typeof match.target_actor === "number") {
    return match.target_actor;
  }
  const username = getSourceText(match, "username");
  const agent = getAgentSources(match).find((candidate) => asString(candidate.username) === username);
  const actor = Number(agent?.actor);
  return Number.isInteger(actor) ? actor : 0;
}

export function getPlayScoreRows(match: PlayMatch): PlayScoreRow[] {
  const agents = getAgentSources(match);
  const scoreMap = scoreMapFromResult(match);
  const playerActor = getPlayerActor(match);
  const rows: PlayScoreRow[] = [];
  const aiActors = agents
    .filter((agent) => Boolean(agent.is_ai))
    .map((agent) => Number(agent.actor))
    .filter((actor) => Number.isInteger(actor) && actor >= 0)
    .sort((a, b) => a - b);

  const actorCount = Math.max(4, agents.length);
  for (let actor = 0; actor < actorCount; actor += 1) {
    const agent = agents.find((candidate) => Number(candidate.actor) === actor);
    const score = scoreMap.get(actor) ?? normalizePoints(agent?.score);
    const isPlayer = actor === playerActor;
    const username = asString(agent?.username);
    const isAi = Boolean(agent?.is_ai);
    const aiOrderIndex = Math.max(aiActors.indexOf(actor), 0);
    rows.push({
      actor,
      name: isPlayer
        ? match.target_player_label || username || "你"
        : isAi
        ? getAiDisplayName(match, username, aiOrderIndex)
        : username || `玩家 ${actor + 1}`,
      isAi,
      isPlayer,
      score,
      delta: score === undefined ? undefined : score - 25000,
    });
  }

  const rankedRows = rows
    .filter((row) => row.score !== undefined)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  rankedRows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return rows.sort((a, b) => {
    if (a.rank !== undefined && b.rank !== undefined) {
      return a.rank - b.rank;
    }
    if (a.rank !== undefined) {
      return -1;
    }
    if (b.rank !== undefined) {
      return 1;
    }
    return a.actor - b.actor;
  });
}

export function getPlayerScoreRow(match: PlayMatch) {
  return getPlayScoreRows(match).find((row) => row.isPlayer);
}
