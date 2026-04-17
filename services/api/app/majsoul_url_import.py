from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

DOWNLOADLOGS_SCRIPT_URL = (
    "https://gist.githubusercontent.com/Equim-chan/875a232a2c1d31181df8b3a8704c3112/raw/"
    "a0533ae7a0ab0158ca9ad9771663e94b82b61572/downloadlogs.js"
)
SUPPORTED_HOST_MARKERS = ("mahjongsoul", "maj-soul", "union-game")
PROFILE_NAMES = ("Default", "Profile 1", "Profile 2", "Profile 3", "Profile 4")


class MajsoulUrlImportError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class BrowserCandidate:
    label: str
    executable_path: Path
    user_data_dir: Path
    profile_name: str


def parse_majsoul_url(url_text: str) -> tuple[str, str]:
    parsed = urlparse(url_text)
    if parsed.scheme not in {"http", "https"}:
        raise MajsoulUrlImportError("majsoul_url must start with http:// or https://")

    host = (parsed.hostname or "").lower()
    if not any(marker in host for marker in SUPPORTED_HOST_MARKERS):
        raise MajsoulUrlImportError("majsoul_url must point to a Mahjong Soul replay page")

    paipu_values = parse_qs(parsed.query).get("paipu", [])
    if not paipu_values or not paipu_values[0].strip():
        raise MajsoulUrlImportError("majsoul_url does not contain a valid paipu parameter")

    game_uuid = paipu_values[0].strip()
    if any(ch.isspace() for ch in game_uuid):
        raise MajsoulUrlImportError("majsoul_url contains an invalid paipu parameter")

    base_url = f"{parsed.scheme}://{parsed.netloc.split('/')[0]}/"
    return base_url, game_uuid


def iter_browser_candidates() -> list[BrowserCandidate]:
    explicit_executable = os.getenv("MAHJONGLAB_MAJSOUL_BROWSER_EXECUTABLE")
    explicit_user_data = os.getenv("MAHJONGLAB_MAJSOUL_BROWSER_USER_DATA_DIR")
    explicit_profile = os.getenv("MAHJONGLAB_MAJSOUL_BROWSER_PROFILE")

    candidates: list[BrowserCandidate] = []
    if explicit_executable and explicit_user_data:
        candidates.extend(
            build_browser_candidates(
                label_prefix="configured-browser",
                executable_path=Path(explicit_executable),
                user_data_dir=Path(explicit_user_data),
                explicit_profile=explicit_profile,
            ),
        )

    candidates.extend(
        build_browser_candidates(
            label_prefix="edge",
            executable_path=Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
            user_data_dir=Path.home() / "AppData" / "Local" / "Microsoft" / "Edge" / "User Data",
            explicit_profile=explicit_profile,
        ),
    )
    candidates.extend(
        build_browser_candidates(
            label_prefix="chrome",
            executable_path=Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
            user_data_dir=Path.home() / "AppData" / "Local" / "Google" / "Chrome" / "User Data",
            explicit_profile=explicit_profile,
        ),
    )

    deduped: list[BrowserCandidate] = []
    seen: set[tuple[str, str, str]] = set()
    for candidate in candidates:
        key = (str(candidate.executable_path), str(candidate.user_data_dir), candidate.profile_name)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(candidate)
    return deduped


def build_browser_candidates(
    *,
    label_prefix: str,
    executable_path: Path,
    user_data_dir: Path,
    explicit_profile: str | None,
) -> list[BrowserCandidate]:
    if not executable_path.exists() or not user_data_dir.exists():
        return []

    profile_names: list[str] = []
    if explicit_profile:
        if (user_data_dir / explicit_profile).exists():
            profile_names.append(explicit_profile)
    else:
        profile_names.extend(name for name in PROFILE_NAMES if (user_data_dir / name).exists())

    if not profile_names:
        profile_names.append("Default")

    return [
        BrowserCandidate(
            label=f"{label_prefix}:{profile_name}",
            executable_path=executable_path,
            user_data_dir=user_data_dir,
            profile_name=profile_name,
        )
        for profile_name in profile_names
    ]


@lru_cache(maxsize=1)
def fetch_downloadlogs_script() -> str:
    request = Request(
        DOWNLOADLOGS_SCRIPT_URL,
        headers={
            "User-Agent": "Mozilla/5.0",
        },
    )
    with urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def build_downloadlogs_bridge_script() -> str:
    script = fetch_downloadlogs_script()
    callback_marker = "function(i, record) {"
    if callback_marker not in script:
        raise MajsoulUrlImportError("downloadlogs bridge script no longer matches the expected callback signature")

    script = script.replace(
        callback_marker,
        (
            "function(i, record) {"
            " if (i) {"
            " window.__MJL_ERROR = typeof i === 'string' ? i : JSON.stringify(i);"
            " return;"
            " }"
        ),
        1,
    )

    export_marker = "})();\n// vim: ts=4  et\n"
    if export_marker not in script:
        raise MajsoulUrlImportError("downloadlogs bridge script no longer matches the expected footer")

    return script.replace(
        export_marker,
        "window.__MJL_DOWNLOADLOG = downloadlog;})();\n// vim: ts=4  et\n",
        1,
    )


def download_majsoul_log_from_url(url_text: str, target_path: Path) -> str:
    base_url, game_uuid = parse_majsoul_url(url_text)
    script = build_downloadlogs_bridge_script()

    errors: list[str] = []
    for candidate in iter_browser_candidates():
        try:
            content = fetch_majsoul_log_with_browser(candidate, base_url, game_uuid, script)
        except MajsoulUrlImportError as exc:
            errors.append(f"{candidate.label}: {exc}")
            continue

        target_path.write_text(content, encoding="utf-8")
        return game_uuid

    if not errors:
        raise MajsoulUrlImportError(
            "no supported local Chrome or Edge browser profile was found; configure "
            "MAHJONGLAB_MAJSOUL_BROWSER_EXECUTABLE and MAHJONGLAB_MAJSOUL_BROWSER_USER_DATA_DIR to continue",
        )

    raise MajsoulUrlImportError(
        "failed to fetch Mahjong Soul replay from local browser session:\n" + "\n".join(errors),
    )


def fetch_majsoul_log_with_browser(
    candidate: BrowserCandidate,
    base_url: str,
    game_uuid: str,
    script: str,
) -> str:
    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # pragma: no cover - import error is environment-specific
        raise MajsoulUrlImportError("playwright is not available; install backend dependencies first") from exc

    try:
        with sync_playwright() as playwright:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(candidate.user_data_dir),
                executable_path=str(candidate.executable_path),
                headless=True,
                args=[f"--profile-directory={candidate.profile_name}"],
            )
            try:
                page = context.pages[0] if context.pages else context.new_page()
                page.goto(base_url, wait_until="networkidle", timeout=120000)
                page.wait_for_function(
                    "() => !!(window.app?.NetAgent && window.GameMgr?.Inst?.getClientVersion)",
                    timeout=60000,
                )
                page.wait_for_timeout(2000)
                result = page.evaluate(
                    """
                    async ({ gameUuid, bridgeScript }) => {
                      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
                      window.__MJL_CAPTURE = null;
                      window.__MJL_ERROR = null;

                      const originalClick = HTMLAnchorElement.prototype.click;
                      HTMLAnchorElement.prototype.click = function (...args) {
                        const href = this.getAttribute("href") || "";
                        if (href.startsWith("data:text/plain;charset=utf-8,")) {
                          window.__MJL_CAPTURE = {
                            filename: this.getAttribute("download") || "majsoul.json",
                            text: decodeURIComponent(href.slice("data:text/plain;charset=utf-8,".length)),
                          };
                          return;
                        }
                        return originalClick.apply(this, args);
                      };

                      try {
                        window.GameMgr.Inst.record_uuid = gameUuid;
                        eval(bridgeScript);
                        if (typeof window.__MJL_DOWNLOADLOG !== "function") {
                          throw new Error("downloadlogs bridge did not expose downloadlog()");
                        }
                        window.__MJL_DOWNLOADLOG();

                        for (let i = 0; i < 90; i += 1) {
                          if (window.__MJL_CAPTURE || window.__MJL_ERROR) {
                            break;
                          }
                          await wait(1000);
                        }

                        return {
                          accountId: window.GameMgr?.Inst?.account_id ?? null,
                          error: window.__MJL_ERROR,
                          captured: window.__MJL_CAPTURE?.text || null,
                        };
                      } catch (error) {
                        return {
                          accountId: window.GameMgr?.Inst?.account_id ?? null,
                          error: String(error),
                          captured: null,
                        };
                      } finally {
                        HTMLAnchorElement.prototype.click = originalClick;
                      }
                    }
                    """,
                    {"gameUuid": game_uuid, "bridgeScript": script},
                )
            finally:
                context.close()
    except PlaywrightError as exc:
        raise MajsoulUrlImportError(
            "browser automation could not start with this profile; close the browser and retry",
        ) from exc

    account_id = result.get("accountId")
    captured = result.get("captured")
    if captured:
        try:
            payload = json.loads(captured)
        except json.JSONDecodeError as exc:
            raise MajsoulUrlImportError("downloaded Mahjong Soul replay could not be parsed as JSON") from exc
        if not isinstance(payload, dict) or "log" not in payload:
            raise MajsoulUrlImportError("downloaded Mahjong Soul replay is not in the expected converter format")
        return captured

    error = result.get("error")
    if error == "no open" or account_id in {-1, None}:
        raise MajsoulUrlImportError(
            "browser profile is not logged into Mahjong Soul; sign in locally and retry",
        )
    if isinstance(error, str) and error:
        raise MajsoulUrlImportError(error)

    raise MajsoulUrlImportError("browser session did not return a Mahjong Soul replay within the timeout")
