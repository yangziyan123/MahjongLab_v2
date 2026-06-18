from __future__ import annotations

import socket
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import patch

from app.play_launcher import MahjongAiLauncher


REPO_ROOT = Path(__file__).resolve().parents[3]
MAHJONG_AI_ROOT = REPO_ROOT / "Mahjong-AI"
sys.path.insert(0, str(MAHJONG_AI_ROOT))

from online_game.server import Client, GameEnvironment  # noqa: E402
from mahjong.yaku import Yaku  # noqa: E402


class PlayLauncherRuleTests(unittest.TestCase):
    def test_build_processes_applies_supported_rule_flags(self) -> None:
        with TemporaryDirectory() as temp_dir:
            settings = SimpleNamespace(
                mahjong_ai_server_host="127.0.0.1",
                mahjong_ai_python="python.exe",
                mahjong_ai_root=MAHJONG_AI_ROOT,
                mahjong_ai_websockify="websockify.exe",
                play_logs_dir=Path(temp_dir),
            )
            launcher = MahjongAiLauncher(settings)

            with patch("app.play_launcher._find_free_port", side_effect=[19001, 19002, 19003]):
                processes = launcher._build_processes(
                    ai_level="hard",
                    match_type="tonpu",
                    seat="north",
                    start_points=30000,
                    aka_dora=0,
                    kuitan=False,
                    allow_south_entry=True,
                )

            command = processes["server"].command
            self.assertIn("--match_type", command)
            self.assertEqual(command[command.index("--match_type") + 1], "tonpu")
            self.assertEqual(command[command.index("--start_points") + 1], "30000")
            self.assertEqual(command[command.index("--human_seat") + 1], "3")
            self.assertIn("--no_aka", command)
            self.assertIn("--disable_kuitan", command)
            self.assertIn("--allow_extra_rounds", command)
            self.assertNotIn("--disable_ai_models", command)


class MahjongAiRuleTests(unittest.TestCase):
    def test_start_points_and_requested_human_seat_are_applied(self) -> None:
        environment = GameEnvironment(AI_count=0, start_points=30000, human_seat=2)
        self.assertEqual([agent.score for agent in environment.agents], [300, 300, 300, 300])

        human_socket = socket.socket()
        try:
            human = Client(human_socket, "User1")
            environment.clients = [
                Client("AI1", "AI1"),
                human,
                Client("AI2", "AI2"),
                Client("AI3", "AI3"),
            ]
            environment.arrange_players()
            self.assertIs(environment.clients[2], human)
        finally:
            human_socket.close()

    def test_tonpu_can_end_after_east_four(self) -> None:
        environment = GameEnvironment(AI_count=0, match_type="tonpu")
        environment.round = 3

        ended, _ = environment.game_update(
            {"why": "yama_end", "nagashimangan": [], "machi_state": {}},
        )

        self.assertTrue(ended)

    def test_tonpu_south_entry_continues_when_everyone_is_below_30000(self) -> None:
        environment = GameEnvironment(
            AI_count=0,
            match_type="tonpu",
            allow_extra_rounds=True,
        )
        environment.round = 3

        ended, _ = environment.game_update(
            {"why": "yama_end", "nagashimangan": [], "machi_state": {}},
        )

        self.assertFalse(ended)
        self.assertEqual(environment.round, 4)

    def test_open_tanyao_fast_path_is_disabled_when_kuitan_is_off(self) -> None:
        yaku = object.__new__(Yaku)
        yaku.agari = "7c000000"
        yaku.riichi = False
        yaku.tsumo = False
        yaku.kui = 1
        yaku.tokusyu = 0
        yaku.allow_open_tanyao = False

        self.assertFalse(yaku.naive_check_yaku())


if __name__ == "__main__":
    unittest.main()
