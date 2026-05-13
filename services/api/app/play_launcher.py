from __future__ import annotations

import json
import shutil
import socket
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from sqlalchemy import select

from .config import Settings
from .database import SessionLocal
from .models import Match, MatchEvent, User
from .schemas import PlayMatchOut, PlayServiceStatus, PlaySessionOut


def _can_connect(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _find_free_port(host: str) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind((host, 0))
        sock.listen(1)
        return int(sock.getsockname()[1])


def _resolve_command(command: str) -> str | None:
    candidate = Path(command)
    if candidate.is_absolute() or candidate.parent != Path("."):
        return str(candidate) if candidate.exists() else None
    return shutil.which(command)


@dataclass(slots=True)
class ManagedProcess:
    name: str
    host: str
    port: int
    command: list[str]
    cwd: Path
    log_path: Path
    process: subprocess.Popen[str] | None = None

    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def stop(self) -> None:
        if self.process is None:
            return
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        self.process = None


@dataclass(slots=True)
class MatchRecorder:
    match_id: str
    username: str
    host: str
    port: int
    stop_event: threading.Event
    thread: threading.Thread | None = None
    seq: int = 0
    started: bool = False
    ended: bool = False


class MahjongAiLauncher:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._lock = threading.Lock()
        self._last_session: PlaySessionOut | None = None
        self._processes: dict[str, ManagedProcess] = {}
        self._recorder: MatchRecorder | None = None

    def _validate_environment(self) -> None:
        missing = []
        if not self.settings.mahjong_ai_root.exists():
            missing.append(str(self.settings.mahjong_ai_root))
        if not (self.settings.mahjong_ai_root / "online_game" / "server.py").exists():
            missing.append(str(self.settings.mahjong_ai_root / "online_game" / "server.py"))
        if not (self.settings.mahjong_ai_root / "online_game" / "web_client" / "index.html").exists():
            missing.append(str(self.settings.mahjong_ai_root / "online_game" / "web_client" / "index.html"))
        if _resolve_command(self.settings.mahjong_ai_python) is None:
            missing.append(f"python command: {self.settings.mahjong_ai_python}")
        if _resolve_command(self.settings.mahjong_ai_websockify) is None:
            missing.append(f"websockify command: {self.settings.mahjong_ai_websockify}")
        if missing:
            joined = "; ".join(missing)
            raise RuntimeError(f"Mahjong-AI environment is not ready: missing {joined}")

    def _spawn(self, proc: ManagedProcess) -> None:
        if proc.is_running() or _can_connect(proc.host, proc.port):
            return
        proc.log_path.parent.mkdir(parents=True, exist_ok=True)
        log_file = proc.log_path.open("a", encoding="utf-8")
        creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        proc.process = subprocess.Popen(
            proc.command,
            cwd=str(proc.cwd),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            creationflags=creationflags,
        )

    def _is_valid_web_service(self, host: str, port: int) -> bool:
        try:
            with urlopen(f"http://{host}:{port}/index.html", timeout=2.0) as response:
                body = response.read(4096).decode("utf-8", "ignore")
                return response.status == 200 and "connecting-form" in body
        except Exception:
            return False

    def _stop_managed_processes(self) -> None:
        if self._recorder is not None:
            self._recorder.stop_event.set()
            if self._recorder.thread is not None and self._recorder.thread.is_alive():
                self._recorder.thread.join(timeout=3)
            self._recorder = None
        for proc in self._processes.values():
            proc.stop()
        self._processes = {}

    def _build_processes(self, ai_level: str) -> dict[str, ManagedProcess]:
        host = self.settings.mahjong_ai_server_host
        server_port = _find_free_port(host)
        websocket_port = _find_free_port(host)
        while websocket_port == server_port:
            websocket_port = _find_free_port(host)
        web_port = _find_free_port(host)
        while web_port in {server_port, websocket_port}:
            web_port = _find_free_port(host)

        server_command = [
            str(self.settings.mahjong_ai_python),
            str(self.settings.mahjong_ai_root / "online_game" / "server.py"),
            "-A",
            "3",
            "-H",
            host,
            "-P",
            str(server_port),
            "--allow_observe",
            "-d",
        ]
        if ai_level == "normal":
            server_command.append("--disable_ai_models")

        return {
            "server": ManagedProcess(
                name="server",
                host=host,
                port=server_port,
                command=server_command,
                cwd=self.settings.mahjong_ai_root,
                log_path=self.settings.play_logs_dir / f"mahjong_ai_server_{server_port}.log",
            ),
            "websockify": ManagedProcess(
                name="websockify",
                host=host,
                port=websocket_port,
                command=[
                    str(self.settings.mahjong_ai_websockify),
                    str(websocket_port),
                    f"{host}:{server_port}",
                ],
                cwd=self.settings.mahjong_ai_root,
                log_path=self.settings.play_logs_dir / f"mahjong_ai_websockify_{websocket_port}.log",
            ),
            "web": ManagedProcess(
                name="web",
                host=host,
                port=web_port,
                command=[
                    str(self.settings.mahjong_ai_python),
                    "-m",
                    "http.server",
                    str(web_port),
                    "--bind",
                    host,
                ],
                cwd=self.settings.mahjong_ai_root / "online_game" / "web_client",
                log_path=self.settings.play_logs_dir / f"mahjong_ai_web_{web_port}.log",
            ),
        }

    def _wait_until_ready(self, proc: ManagedProcess, timeout_seconds: float = 90.0) -> None:
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if proc.name == "web":
                if self._is_valid_web_service(proc.host, proc.port):
                    return
            elif _can_connect(proc.host, proc.port):
                return
            if proc.process is not None and proc.process.poll() is not None:
                raise RuntimeError(f"{proc.name} exited before becoming ready")
            time.sleep(0.2)
        raise RuntimeError(f"{proc.name} did not become ready on {proc.host}:{proc.port}")

    def _service_status(self, proc: ManagedProcess) -> PlayServiceStatus:
        running = proc.is_running()
        reachable = self._is_valid_web_service(proc.host, proc.port) if proc.name == "web" else _can_connect(proc.host, proc.port)
        detail = None
        if not reachable and running:
            detail = "process running, waiting for port"
        elif reachable and not running and proc.process is None:
            detail = "already running outside MahjongLab"
        elif proc.process is not None and not running:
            detail = f"process exited with code {proc.process.poll()}"
        return PlayServiceStatus(
            name=proc.name,
            host=proc.host,
            port=proc.port,
            running=running,
            reachable=reachable,
            managed=proc.process is not None,
            detail=detail,
        )

    def _tile_to_mjai(self, tile_id: int | None) -> str:
        if tile_id is None:
            return "?"
        tile = tile_id // 4
        if tile <= 8:
            rank = tile + 1
            if tile_id == 16:
                return "5mr"
            return f"{rank}m"
        if tile <= 17:
            rank = tile - 8
            if tile_id == 52:
                return "5pr"
            return f"{rank}p"
        if tile <= 26:
            rank = tile - 17
            if tile_id == 88:
                return "5sr"
            return f"{rank}s"
        honors = {27: "E", 28: "S", 29: "W", 30: "N", 31: "P", 32: "F", 33: "C"}
        return honors.get(tile, "?")

    def _append_match_event(self, match_id: str, event: dict) -> None:
        with SessionLocal() as db:
            match_event = MatchEvent(
                match_id=match_id,
                seq=self._recorder.seq if self._recorder is not None else 0,
                event_type=str(event.get("type") or "unknown"),
                payload_json=event,
            )
            db.add(match_event)
            db.commit()
        if self._recorder is not None:
            self._recorder.seq += 1

    def _update_match(self, match_id: str, status: str, result: dict | None = None) -> None:
        with SessionLocal() as db:
            match = db.get(Match, match_id)
            if match is None:
                return
            match.status = status
            if result is not None:
                match.result_json = result
            db.commit()

    def _convert_protocol_event(self, recorder: MatchRecorder, message: dict) -> list[dict]:
        event_name = message.get("event")
        converted: list[dict] = []

        if event_name == "start":
            self._update_match(
                recorder.match_id,
                "running",
                {"last_event": "start", "round": int(message.get("game", {}).get("round", 0)) + 1},
            )
            game = message.get("game", {})
            round_index = int(game.get("round", 0))
            honba = int(game.get("honba", 0))
            bakaze = "E" if round_index < 4 else "S"
            kyoku = (round_index % 4) + 1
            if self._recorder is not None and not self._recorder.started:
                converted.append({"type": "start_game"})
                self._recorder.started = True

            converted.append(
                {
                    "type": "start_kyoku",
                    "bakaze": bakaze,
                    "kyoku": kyoku,
                    "honba": honba,
                    "kyotaku": int(game.get("riichi_ba", 0)),
                    "oya": int(round_index % 4),
                    "dora_marker": [self._tile_to_mjai(x) for x in game.get("dora_indicator", [])],
                    "scores": [int(agent.get("score", 250) * 100) for agent in game.get("agents", [])],
                },
            )
            return converted

        if event_name == "draw":
            converted.append(
                {
                    "type": "tsumo",
                    "actor": int(message.get("who", 0)),
                    "pai": self._tile_to_mjai(message.get("tile_id")),
                },
            )
            return converted

        if event_name == "discard":
            converted.append(
                {
                    "type": "dahai",
                    "actor": int(message.get("who", 0)),
                    "pai": self._tile_to_mjai(message.get("tile_id")),
                    "tsumogiri": bool(message.get("mode", False)),
                },
            )
            return converted

        if event_name in {"chi", "pon"}:
            action = message.get("action", {})
            pattern = action.get("pattern", [])
            kui = action.get("kui")
            converted.append(
                {
                    "type": event_name,
                    "actor": int(action.get("who", 0)),
                    "target": int(action.get("from_who", 0)),
                    "pai": self._tile_to_mjai(kui),
                    "consumed": [self._tile_to_mjai(x) for x in pattern if x != kui],
                },
            )
            return converted

        if event_name in {"kan", "addkan"}:
            action = message.get("action", {})
            pattern = action.get("pattern", [])
            if event_name == "addkan":
                kan_type = "kakan"
                add_tile = pattern[2] if isinstance(pattern, list) and len(pattern) >= 3 else None
                consumed = [self._tile_to_mjai(add_tile)] if add_tile is not None else []
            else:
                kan_mode = pattern[0] if isinstance(pattern, list) and pattern else 0
                if kan_mode == 0:
                    kan_type = "ankan"
                    base = int(pattern[1]) if len(pattern) > 1 else 0
                    consumed = [self._tile_to_mjai(base * 4 + i) for i in range(4)]
                elif kan_mode == 1:
                    kan_type = "daiminkan"
                    base = int(pattern[1]) if len(pattern) > 1 else 0
                    consumed = [self._tile_to_mjai(base * 4 + i) for i in range(3)]
                else:
                    kan_type = "kakan"
                    consumed = []

            converted.append(
                {
                    "type": kan_type,
                    "actor": int(action.get("who", 0)),
                    "target": int(action.get("from_who", action.get("who", 0))),
                    "pai": self._tile_to_mjai(action.get("kui")),
                    "consumed": consumed,
                },
            )
            return converted

        if event_name == "riichi":
            action = message.get("action", {})
            if int(action.get("step", 0)) == 1:
                converted.append({"type": "reach", "actor": int(action.get("who", 0))})
            return converted

        if event_name == "agari":
            for action in message.get("action", []):
                converted.append(
                    {
                        "type": "hora",
                        "actor": int(action.get("who", 0)),
                        "target": int(action.get("from_who", action.get("who", 0))),
                        "pai": self._tile_to_mjai(action.get("machi")),
                    },
                )
            return converted

        if event_name == "ryuukyoku":
            converted.append({"type": "ryukyoku"})
            converted.append({"type": "end_kyoku"})
            self._update_match(
                recorder.match_id,
                "round_finished",
                {"last_event": "ryuukyoku", "detail": message},
            )
            return converted

        if event_name == "settlement":
            converted.append({"type": "end_kyoku"})
            self._update_match(
                recorder.match_id,
                "round_finished",
                {"last_event": "settlement", "detail": message},
            )
            return converted

        if event_name == "score":
            converted.append({"type": "end_game", "scores": message.get("score", [])})
            return converted

        if event_name == "end":
            if self._recorder is not None and not self._recorder.ended:
                converted.append({"type": "end_game"})
            return converted

        return converted

    def _record_loop(self, recorder: MatchRecorder) -> None:
        joined = False
        sock: socket.socket | None = None
        try:
            while not recorder.stop_event.is_set():
                try:
                    sock = socket.create_connection((recorder.host, recorder.port), timeout=3)
                    sock.settimeout(None)
                    break
                except OSError:
                    time.sleep(0.3)

            if sock is None:
                self._update_match(recorder.match_id, "failed", {"message": "recorder failed to connect"})
                return

            with sock:
                stream = sock.makefile("rwb")
                join_message = {"username": f"recorder-{recorder.match_id[:8]}", "observe": True}
                stream.write((json.dumps(join_message) + "\n").encode("utf-8"))
                stream.flush()
                self._update_match(recorder.match_id, "running")

                while not recorder.stop_event.is_set():
                    try:
                        line = stream.readline()
                    except TimeoutError:
                        continue
                    if not line:
                        break
                    try:
                        message = json.loads(line.decode("utf-8"))
                    except json.JSONDecodeError:
                        continue

                    if message.get("event") == "join":
                        joined = True
                    converted_events = self._convert_protocol_event(recorder, message)
                    for event in converted_events:
                        self._append_match_event(recorder.match_id, event)

                    if message.get("event") == "score":
                        self._update_match(recorder.match_id, "completed", {"score": message.get("score", [])})
                        recorder.ended = True
                    if message.get("event") == "end":
                        self._update_match(recorder.match_id, "completed")
                        recorder.ended = True
                        break

        finally:
            if not recorder.ended and joined:
                self._update_match(recorder.match_id, "running")

    def _ensure_default_user_id(self, db) -> str:
        user = db.scalar(select(User).limit(1))
        if user is not None:
            return user.id
        user = User(display_name="MahjongLab User")
        db.add(user)
        db.commit()
        db.refresh(user)
        return user.id

    def _create_match(self, username: str, ai_level: str) -> Match:
        with SessionLocal() as db:
            user_id = self._ensure_default_user_id(db)
            match = Match(
                user_id=user_id,
                status="created",
                match_type="hanchan",
                source_json={"origin": "mahjong_ai", "username": username, "ai_level": ai_level},
            )
            db.add(match)
            db.commit()
            db.refresh(match)
            return match

    def ensure_running(self, username: str, ai_level: str = "normal") -> PlaySessionOut:
        username = username.strip()
        if not username:
            raise RuntimeError("username is required")
        if ai_level not in {"normal", "hard"}:
            raise RuntimeError("ai_level must be normal or hard")
        if ai_level == "hard":
            model_path = self.settings.mahjong_ai_root / "model" / "saved" / "discard-model" / "best.pt"
            if not model_path.exists():
                raise RuntimeError("hard 难度需要 Mahjong-AI/model/saved 权重文件，请先准备模型。")

        with self._lock:
            self._validate_environment()
            match = self._create_match(username, ai_level)

            self._stop_managed_processes()
            self._processes = self._build_processes(ai_level)

            for name in ("server", "websockify", "web"):
                proc = self._processes[name]
                self._spawn(proc)
                self._wait_until_ready(proc)
            server_proc = self._processes["server"]
            websocket_proc = self._processes["websockify"]
            web_proc = self._processes["web"]

            params = urlencode(
                {
                    "host": server_proc.host,
                    "port": websocket_proc.port,
                    "username": username,
                    "autoconnect": "1",
                },
            )
            game_url = f"http://{web_proc.host}:{web_proc.port}/index.html"

            recorder = MatchRecorder(
                match_id=match.id,
                username=username,
                host=server_proc.host,
                port=server_proc.port,
                stop_event=threading.Event(),
            )
            recorder.thread = threading.Thread(
                target=self._record_loop,
                args=(recorder,),
                daemon=True,
                name=f"play-recorder-{match.id[:8]}",
            )
            recorder.thread.start()
            self._recorder = recorder

            session = PlaySessionOut(
                session_id=str(uuid.uuid4()),
                match_id=match.id,
                username=username,
                status="ready",
                host=server_proc.host,
                websocket_port=websocket_proc.port,
                web_port=web_proc.port,
                game_url=game_url,
                launch_url=f"{game_url}?{params}",
                services=[self._service_status(proc) for proc in self._processes.values()],
            )
            self._last_session = session
            return session

    def get_status(self) -> PlaySessionOut | None:
        with self._lock:
            if self._last_session is None:
                return None
            return PlaySessionOut(
                session_id=self._last_session.session_id,
                match_id=self._last_session.match_id,
                username=self._last_session.username,
                status="ready" if all(self._service_status(p).reachable for p in self._processes.values()) else "starting",
                host=self._last_session.host,
                websocket_port=self._last_session.websocket_port,
                web_port=self._last_session.web_port,
                game_url=self._last_session.game_url,
                launch_url=self._last_session.launch_url,
                services=[self._service_status(proc) for proc in self._processes.values()],
            )

    def get_match(self, match_id: str) -> PlayMatchOut | None:
        with SessionLocal() as db:
            match = db.get(Match, match_id)
            if match is None:
                return None
            return PlayMatchOut(
                id=match.id,
                status=match.status,
                source=match.source_json or {},
                result=match.result_json,
                created_at=match.created_at,
                updated_at=match.updated_at,
            )

    def export_match_events_jsonl(self, match_id: str) -> str:
        with SessionLocal() as db:
            stmt = select(MatchEvent).where(MatchEvent.match_id == match_id).order_by(MatchEvent.seq.asc())
            events = db.scalars(stmt).all()
            if not events:
                raise RuntimeError(f"no match events found for match_id={match_id}")
            return "".join(json.dumps(event.payload_json, ensure_ascii=False) + "\n" for event in events)
