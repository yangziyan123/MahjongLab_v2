export function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export function formatPlatform(platform?: string | null) {
  if (platform === "internal") {
    return "平台内";
  }
  if (platform === "tenhou") {
    return "天凤";
  }
  if (platform === "majsoul") {
    return "雀魂";
  }
  return platform || "未知";
}

export function formatSourceType(sourceType: string) {
  if (sourceType === "inline_json") {
    return "JSON";
  }
  if (sourceType === "upload_file") {
    return "文件";
  }
  if (sourceType === "internal_match") {
    return "平台内对局";
  }
  if (sourceType === "tenhou_url") {
    return "天凤链接";
  }
  if (sourceType === "tenhou_id") {
    return "天凤 ID";
  }
  if (sourceType === "majsoul_url") {
    return "雀魂链接";
  }
  return sourceType;
}

export function formatDecisionType(decisionType: string) {
  const mapping: Record<string, string> = {
    discard: "打牌",
    riichi: "立直",
    chi: "吃",
    pon: "碰",
    kan: "杠",
    agari: "和牌",
    ryukyoku: "流局",
    pass: "跳过",
    other: "其他",
  };
  return mapping[decisionType] || decisionType;
}

export function formatKyokuLabel(kyokuIndex: number, honba: number) {
  const roundNames = ["东", "南", "西", "北"];
  const round = roundNames[Math.floor(kyokuIndex / 4)] || "局";
  const hand = (kyokuIndex % 4) + 1;
  return `${round}${hand}局 ${honba} 本场`;
}

export function formatRelativeSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
