from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urljoin, urlparse
from urllib.request import Request, urlopen

SUPPORTED_HOST_MARKERS = ("mahjongsoul", "maj-soul", "union-game")
PROFILE_NAMES = ("Default", "Profile 1", "Profile 2", "Profile 3", "Profile 4")
SNAPSHOT_ROOT_FILES = ("Local State", "First Run")
FRAME_REQUEST = 0x02
FRAME_RESPONSE = 0x03
FETCH_GAME_RECORD_MARKER = b"fetchGameRecord\x12"
DEFAULT_CAPTURE_TIMEOUT_SECONDS = 90
SNAPSHOT_SKIP_NAMES = {
    "Cache",
    "Code Cache",
    "Crashpad",
    "DawnCache",
    "DawnGraphiteCache",
    "DawnWebGPUCache",
    "GPUCache",
    "GrShaderCache",
    "ShaderCache",
    "SingletonCookie",
    "SingletonLock",
    "SingletonSocket",
}
FALLBACK_BROWSER_EXECUTABLES = (
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
)


class MajsoulUrlImportError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class BrowserCandidate:
    label: str
    executable_path: Path
    user_data_dir: Path
    profile_name: str

    @property
    def profile_dir(self) -> Path:
        return self.user_data_dir / self.profile_name


@dataclass(slots=True)
class GameRecordFrameCapture:
    pending_indexes: dict[int, int]
    response: bytes | None = None
    saw_binary_frame: bool = False
    saw_record_request: bool = False

    def __init__(self) -> None:
        self.pending_indexes = {}
        self.response = None
        self.saw_binary_frame = False
        self.saw_record_request = False

    def observe_sent(self, connection_id: int, payload: str | bytes) -> None:
        frame = binary_frame(payload)
        if frame is None:
            return
        self.saw_binary_frame = True
        if len(frame) < 3 or frame[0] != FRAME_REQUEST:
            return
        if FETCH_GAME_RECORD_MARKER not in frame:
            return
        self.pending_indexes[connection_id] = frame_index(frame)
        self.saw_record_request = True

    def observe_received(self, connection_id: int, payload: str | bytes) -> None:
        frame = binary_frame(payload)
        if frame is None:
            return
        self.saw_binary_frame = True
        if len(frame) < 3 or frame[0] != FRAME_RESPONSE:
            return
        expected_index = self.pending_indexes.get(connection_id)
        if expected_index is None or frame_index(frame) != expected_index:
            return
        self.response = frame
        self.pending_indexes.pop(connection_id, None)


def binary_frame(payload: str | bytes) -> bytes | None:
    return payload if isinstance(payload, bytes) else None


def frame_index(frame: bytes) -> int:
    return int.from_bytes(frame[1:3], byteorder="little")


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


def sanitize_snapshot_prefix(label: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9_-]+", "-", label).strip("-").lower()
    return sanitized or "browser"


def should_skip_snapshot_path(path: Path) -> bool:
    return path.name in SNAPSHOT_SKIP_NAMES


def copy_browser_snapshot(src: Path, dst: Path) -> None:
    if should_skip_snapshot_path(src):
        return

    if src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        for child in src.iterdir():
            copy_browser_snapshot(child, dst / child.name)
        return

    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
    except OSError:
        # Browser-owned files such as live session journals may be locked; the
        # replay import only needs the persisted auth/site state, so a best-effort
        # snapshot is sufficient here.
        return


def create_browser_snapshot(candidate: BrowserCandidate) -> tuple[BrowserCandidate, tempfile.TemporaryDirectory[str]]:
    if not candidate.profile_dir.exists():
        raise MajsoulUrlImportError(f"browser profile directory does not exist: {candidate.profile_dir}")

    temp_dir = tempfile.TemporaryDirectory(prefix=f"mjl-{sanitize_snapshot_prefix(candidate.label)}-")
    snapshot_root = Path(temp_dir.name) / "User Data"
    snapshot_profile_dir = snapshot_root / candidate.profile_name
    snapshot_profile_dir.mkdir(parents=True, exist_ok=True)

    for name in SNAPSHOT_ROOT_FILES:
        root_file = candidate.user_data_dir / name
        if root_file.exists():
            copy_browser_snapshot(root_file, snapshot_root / name)

    copy_browser_snapshot(candidate.profile_dir, snapshot_profile_dir)
    snapshot_candidate = BrowserCandidate(
        label=f"{candidate.label}:snapshot",
        executable_path=candidate.executable_path,
        user_data_dir=snapshot_root,
        profile_name=candidate.profile_name,
    )
    return snapshot_candidate, temp_dir


def iter_launchable_executables(primary: Path) -> Iterator[Path]:
    seen: set[Path] = set()
    for executable in (primary, *FALLBACK_BROWSER_EXECUTABLES):
        if executable in seen or not executable.exists():
            continue
        seen.add(executable)
        yield executable


def download_record_data(data_url: str, base_url: str) -> bytes:
    request = Request(
        urljoin(base_url, data_url),
        headers={
            "Referer": base_url,
            "User-Agent": "Mozilla/5.0",
        },
    )
    try:
        with urlopen(request, timeout=60) as response:
            return response.read()
    except HTTPError as exc:
        raise MajsoulUrlImportError(f"failed to download Mahjong Soul record data: HTTP {exc.code}") from exc
    except URLError as exc:
        raise MajsoulUrlImportError(f"failed to download Mahjong Soul record data: {exc.reason}") from exc


def decode_majsoul_record_frame(frame: bytes, base_url: str) -> str:
    try:
        from google.protobuf.message import DecodeError
        from ms import protocol_pb2 as protocol
        from tensoul.downloader import MajsoulPaipuDownloader
    except Exception as exc:  # pragma: no cover - import error is environment-specific
        raise MajsoulUrlImportError(
            "Mahjong Soul protocol decoder is unavailable; install backend dependencies first",
        ) from exc

    if len(frame) < 4 or frame[0] != FRAME_RESPONSE:
        raise MajsoulUrlImportError("captured Mahjong Soul frame is not a record response")

    try:
        wrapper = protocol.Wrapper()
        wrapper.ParseFromString(frame[3:])
        record = protocol.ResGameRecord()
        record.ParseFromString(wrapper.data)
    except DecodeError as exc:
        raise MajsoulUrlImportError("captured Mahjong Soul record response could not be decoded") from exc

    if record.error.code:
        raise MajsoulUrlImportError(f"Mahjong Soul returned record error code {record.error.code}")
    if not record.HasField("head"):
        raise MajsoulUrlImportError("captured response is not a Mahjong Soul game record")
    if not record.data and record.data_url:
        record.data = download_record_data(record.data_url, base_url)
    if not record.data:
        raise MajsoulUrlImportError("Mahjong Soul game record response did not contain replay data")

    try:
        converter = MajsoulPaipuDownloader.__new__(MajsoulPaipuDownloader)
        payload = converter._handle_game_record(record)
    except Exception as exc:
        raise MajsoulUrlImportError(f"failed to convert Mahjong Soul replay: {exc}") from exc

    if not isinstance(payload, dict) or not isinstance(payload.get("log"), list):
        raise MajsoulUrlImportError("converted Mahjong Soul replay is not in the expected converter format")
    return json.dumps(payload, ensure_ascii=False)


def download_majsoul_log_from_url(url_text: str, target_path: Path) -> str:
    replay_url = url_text.strip()
    base_url, game_uuid = parse_majsoul_url(replay_url)

    errors: list[str] = []
    for candidate in iter_browser_candidates():
        try:
            frame = fetch_majsoul_record_frame_with_browser(candidate, replay_url)
            content = decode_majsoul_record_frame(frame, base_url)
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


def fetch_majsoul_record_frame_with_browser(
    candidate: BrowserCandidate,
    replay_url: str,
) -> bytes:
    try:
        from playwright.sync_api import Error as PlaywrightError
        from playwright.sync_api import sync_playwright
    except Exception as exc:  # pragma: no cover - import error is environment-specific
        raise MajsoulUrlImportError("playwright is not available; install backend dependencies first") from exc

    snapshot_candidate, snapshot_temp_dir = create_browser_snapshot(candidate)
    launch_errors: list[str] = []
    capture_timeout_seconds = max(
        10,
        int(os.getenv("MAHJONGLAB_MAJSOUL_CAPTURE_TIMEOUT_SECONDS", DEFAULT_CAPTURE_TIMEOUT_SECONDS)),
    )
    try:
        with sync_playwright() as playwright:
            for executable_path in iter_launchable_executables(snapshot_candidate.executable_path):
                try:
                    context = playwright.chromium.launch_persistent_context(
                        user_data_dir=str(snapshot_candidate.user_data_dir),
                        executable_path=str(executable_path),
                        headless=True,
                        args=[f"--profile-directory={snapshot_candidate.profile_name}"],
                    )
                except PlaywrightError as exc:
                    launch_errors.append(f"{executable_path.name}: {exc}")
                    continue

                try:
                    page = context.pages[0] if context.pages else context.new_page()
                    capture = GameRecordFrameCapture()

                    def observe_websocket(websocket: object) -> None:
                        connection_id = id(websocket)
                        websocket.on(
                            "framesent",
                            lambda payload: capture.observe_sent(connection_id, payload),
                        )
                        websocket.on(
                            "framereceived",
                            lambda payload: capture.observe_received(connection_id, payload),
                        )

                    page.on("websocket", observe_websocket)
                    page.goto(replay_url, wait_until="domcontentloaded", timeout=120000)

                    deadline = time.monotonic() + capture_timeout_seconds
                    while capture.response is None and time.monotonic() < deadline:
                        page.wait_for_timeout(250)

                    if capture.response is not None:
                        return capture.response
                    if capture.saw_record_request:
                        raise MajsoulUrlImportError(
                            "browser requested the replay but Mahjong Soul did not return it before the timeout",
                        )
                    if capture.saw_binary_frame:
                        raise MajsoulUrlImportError(
                            "browser session did not request this replay; sign in to Mahjong Soul in this profile and retry",
                        )
                    raise MajsoulUrlImportError(
                        "Mahjong Soul game connection did not start; this browser profile may not be logged in",
                    )
                finally:
                    context.close()
            else:
                detail = "\n".join(launch_errors) if launch_errors else "no launch attempts succeeded"
                raise MajsoulUrlImportError(
                    "browser automation could not start with the local browser snapshot:\n" + detail,
                )
    finally:
        snapshot_temp_dir.cleanup()
