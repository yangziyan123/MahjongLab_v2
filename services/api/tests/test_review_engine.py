from __future__ import annotations

import json
import unittest
from tempfile import TemporaryDirectory
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
import app.main as main_app
from app.majsoul_url_import import (
    FETCH_GAME_RECORD_MARKER,
    FRAME_REQUEST,
    FRAME_RESPONSE,
    GameRecordFrameCapture,
    MajsoulUrlImportError,
    decode_majsoul_record_frame,
    parse_majsoul_url,
)
from app.models import Match, MatchEvent, ReviewJob, User
from app.play_launcher import MahjongAiLauncher, MatchRecorder, target_actor_from_agents
from app.review_engine import (
    ReviewExecutionError,
    build_review,
    decode_text_bytes,
    determine_target_actor,
    is_tenhou_sanma_log,
    load_events_from_file,
    load_events_for_job,
    normalize_internal_match_events_for_mjai,
    next_actual_action,
    parse_mjai_jsonl,
    parse_tenhou_log_payload,
    run_fallback_review,
    serialize_mjai_jsonl,
    validate_target_actor_visibility,
    validate_tenhou_log_payload,
    visible_hand_actors,
)
from app.review_engine import settings as review_settings


class TenhouLogValidationTests(unittest.TestCase):
    def test_detects_sanma_log_before_conversion(self) -> None:
        sanma_payload = {
            "ref": "2024112700gm-0119-0001-4f9c7e06",
            "log": [
                [
                    [0, 0, 0],
                    [40000, 40000, 40000, 0],
                    [52],
                    [],
                    [19, 21, 21, 31, 32, 33, 53, 36, 37, 43, 43, 44, 46],
                    [25],
                    [19],
                    [11, 24, 28, 31, 34, 35, 38, 39, 39, 42, 42, 42, 47],
                    [11],
                    [28],
                    [19, 19, 21, 22, 23, 24, 25, 26, 27, 29, 37, 46, 47],
                    [35],
                    [47],
                    [],
                    [],
                    [],
                    ["和了", [-2600, 5200, -2600, 0], [1, 1, 1]],
                ]
            ],
            "name": ["A", "B", "C", ""],
            "rule": {"disp": "三麻"},
        }

        self.assertTrue(is_tenhou_sanma_log(sanma_payload))
        with self.assertRaisesRegex(ReviewExecutionError, "sanma log .* is not supported yet"):
            validate_tenhou_log_payload(sanma_payload, "2024112700gm-0119-0001-4f9c7e06")

    def test_allows_regular_four_player_tenhou_log(self) -> None:
        sample_path = Path(__file__).resolve().parents[1] / "data" / "smoke" / "tenhou_raw.json"
        payload = parse_tenhou_log_payload(sample_path.read_text(encoding="utf-8"), "2019050417gm-0029-0000-4f2a8622")

        self.assertFalse(is_tenhou_sanma_log(payload))
        validate_tenhou_log_payload(payload, "2019050417gm-0029-0000-4f2a8622")


class MajsoulUrlImportTests(unittest.TestCase):
    def test_parse_majsoul_url_extracts_origin_and_uuid(self) -> None:
        base_url, game_uuid = parse_majsoul_url("https://game.maj-soul.com/1/?paipu=240101-uuid-demo")

        self.assertEqual(base_url, "https://game.maj-soul.com/")
        self.assertEqual(game_uuid, "240101-uuid-demo")

    def test_parse_majsoul_url_rejects_missing_paipu(self) -> None:
        with self.assertRaisesRegex(MajsoulUrlImportError, "valid paipu parameter"):
            parse_majsoul_url("https://game.maj-soul.com/1/")

    def test_capture_matches_fetch_game_record_response_by_index(self) -> None:
        capture = GameRecordFrameCapture()
        request = bytes([FRAME_REQUEST, 0x34, 0x12]) + FETCH_GAME_RECORD_MARKER

        capture.observe_sent(1, request)
        capture.observe_received(1, bytes([FRAME_RESPONSE, 0x35, 0x12]) + b"wrong")
        self.assertIsNone(capture.response)

        expected = bytes([FRAME_RESPONSE, 0x34, 0x12]) + b"record"
        capture.observe_received(1, expected)

        self.assertEqual(capture.response, expected)
        self.assertTrue(capture.saw_record_request)

    def test_capture_ignores_fetch_game_record_list(self) -> None:
        capture = GameRecordFrameCapture()
        capture.observe_sent(
            1,
            bytes([FRAME_REQUEST, 0x01, 0x00]) + b"fetchGameRecordList\x12",
        )

        self.assertFalse(capture.saw_record_request)

    def test_decode_record_frame_rejects_non_response(self) -> None:
        with self.assertRaisesRegex(MajsoulUrlImportError, "not a record response"):
            decode_majsoul_record_frame(b"\x02\x01\x00invalid", "https://game.maj-soul.com/")

    def test_decode_record_frame_converts_protocol_response(self) -> None:
        from ms import protocol_pb2 as protocol

        def wrap(name: str, message: object) -> bytes:
            return protocol.Wrapper(name=name, data=message.SerializeToString()).SerializeToString()

        record = protocol.ResGameRecord()
        record.head.uuid = "test-record"
        record.head.end_time = 1
        record.head.config.mode.mode = 1
        for seat in range(4):
            player = record.head.result.players.add()
            player.seat = seat
            player.part_point_1 = 25000
            player.total_point = 25000

        new_round = protocol.RecordNewRound(chang=0, ju=0, dora="1m")
        new_round.scores.extend([25000] * 4)
        new_round.tiles0.extend(
            ["1m", "1m", "1m", "2m", "2m", "2m", "3m", "3m", "3m", "4m", "4m", "4m", "5m", "5m"],
        )
        for field_name in ("tiles1", "tiles2", "tiles3"):
            getattr(new_round, field_name).extend(
                ["1p", "1p", "1p", "2p", "2p", "2p", "3p", "3p", "3p", "4p", "4p", "4p", "5p"],
            )

        details = protocol.GameDetailRecords()
        details.records.extend(
            [
                wrap(".lq.RecordNewRound", new_round),
                wrap(".lq.RecordLiuJu", protocol.RecordLiuJu(type=1)),
            ],
        )
        record.data = wrap(".lq.GameDetailRecords", details)
        frame = (
            bytes([FRAME_RESPONSE, 0x01, 0x00])
            + protocol.Wrapper(data=record.SerializeToString()).SerializeToString()
        )

        payload = json.loads(decode_majsoul_record_frame(frame, "https://game.maj-soul.com/"))

        self.assertEqual(payload["ref"], "test-record")
        self.assertEqual(payload["ratingc"], "PF4")
        self.assertEqual(len(payload["log"]), 1)


class ReplaySourceVisibilityTests(unittest.TestCase):
    def test_majsoul_import_sources_are_hidden(self) -> None:
        source_keys = {
            item.key
            for item in main_app.list_replay_sources()["items"]
        }

        self.assertNotIn("majsoul_file", source_keys)
        self.assertNotIn("majsoul_url", source_keys)


class TargetActorValidationTests(unittest.TestCase):
    def test_majsoul_import_requires_explicit_target_player(self) -> None:
        job = SimpleNamespace(source_type="majsoul_url", target_actor=None, target_player_ref=None)

        with self.assertRaisesRegex(ReviewExecutionError, "target_player_ref"):
            determine_target_actor(job)

    def test_majsoul_import_accepts_explicit_target_player(self) -> None:
        job = SimpleNamespace(source_type="majsoul_file", target_actor=None, target_player_ref="2")

        self.assertEqual(determine_target_actor(job), 2)

    def test_upload_auto_detects_only_visible_hand(self) -> None:
        events = [
            {
                "type": "start_kyoku",
                "tehais": [["?"] * 13, ["1m"] * 13, ["?"] * 13, ["?"] * 13],
            },
        ]
        job = SimpleNamespace(source_type="upload_file", target_actor=None, target_player_ref=None)

        self.assertEqual(visible_hand_actors(events), {1})
        self.assertEqual(determine_target_actor(job, events), 1)

    def test_explicit_upload_target_takes_precedence(self) -> None:
        events = [
            {
                "type": "start_kyoku",
                "tehais": [["?"] * 13, ["1m"] * 13, ["?"] * 13, ["?"] * 13],
            },
        ]
        job = SimpleNamespace(source_type="upload_file", target_actor=None, target_player_ref="3")

        self.assertEqual(determine_target_actor(job, events), 3)

    def test_hidden_upload_target_has_clear_error(self) -> None:
        events = [
            {
                "type": "start_kyoku",
                "tehais": [["?"] * 13, ["1m"] * 13, ["?"] * 13, ["?"] * 13],
            },
        ]

        with self.assertRaisesRegex(ReviewExecutionError, "player 0 hand is hidden"):
            validate_target_actor_visibility(events, 0)


class TextDecodingTests(unittest.TestCase):
    def test_decode_text_bytes_falls_back_to_gb18030(self) -> None:
        self.assertEqual(decode_text_bytes("错误信息".encode("gb18030")), "错误信息")

    def test_load_events_from_file_accepts_gbk_jsonl(self) -> None:
        with TemporaryDirectory() as temp_dir:
            replay_path = Path(temp_dir) / "replay.jsonl"
            payload = {"type": "start_game", "note": "中文备注"}
            replay_path.write_bytes((json.dumps(payload, ensure_ascii=False) + "\n").encode("gb18030"))

            self.assertEqual(load_events_from_file(replay_path), [payload])


class MjaiJsonlTests(unittest.TestCase):
    def test_jsonl_round_trip(self) -> None:
        events = [{"type": "start_game"}, {"type": "end_game"}]

        self.assertEqual(parse_mjai_jsonl(serialize_mjai_jsonl(events)), events)

    def test_jsonl_parse_error_reports_line_number(self) -> None:
        with self.assertRaisesRegex(ReviewExecutionError, "line 2"):
            parse_mjai_jsonl('{"type":"start_game"}\nnot-json\n')

    def test_legacy_json_upload_is_persisted_as_jsonl(self) -> None:
        class StubSession:
            commits = 0

            def commit(self) -> None:
                self.commits += 1

        with TemporaryDirectory() as temp_dir:
            old_storage_dir = review_settings.storage_dir
            try:
                review_settings.storage_dir = Path(temp_dir)
                upload_path = review_settings.storage_dir / "uploads" / "legacy.json"
                upload_path.parent.mkdir(parents=True)
                events = [{"type": "start_game"}, {"type": "end_game"}]
                upload_path.write_text(json.dumps(events), encoding="utf-8")
                job = SimpleNamespace(
                    id="legacy-upload",
                    source_type="upload_file",
                    source_payload={"file_key": "uploads/legacy.json"},
                    normalized_mjai_object_key=None,
                )
                db = StubSession()

                self.assertEqual(load_events_for_job(db, job), events)
                self.assertEqual(job.normalized_mjai_object_key, "normalized/uploads/legacy-upload.jsonl")
                normalized_path = review_settings.storage_dir / job.normalized_mjai_object_key
                self.assertEqual(parse_mjai_jsonl(normalized_path.read_text(encoding="utf-8")), events)
                self.assertEqual(db.commits, 1)
            finally:
                review_settings.storage_dir = old_storage_dir

    def test_uploaded_internal_export_is_repaired_for_review(self) -> None:
        events = [
            {"type": "start_game"},
            {
                "type": "start_kyoku",
                "bakaze": "E",
                "kyoku": 1,
                "honba": 0,
                "kyotaku": 0,
                "oya": 0,
                "dora_marker": "1m",
                "scores": [25000, 25000, 25000, 25000],
                "tehais": [["?"] * 13, ["1m"] * 13, ["?"] * 13, ["?"] * 13],
            },
            {"type": "ryukyoku"},
            {"type": "end_kyoku"},
            {"type": "end_kyoku"},
        ]

        normalized = normalize_internal_match_events_for_mjai(events)

        self.assertEqual(normalized[-2], {"type": "ryukyoku", "deltas": [0, 0, 0, 0]})
        self.assertEqual(normalized[-1], {"type": "end_kyoku"})

    def test_play_export_writes_reviewable_jsonl(self) -> None:
        rows = [
            SimpleNamespace(payload_json={"type": "start_game"}),
            SimpleNamespace(
                payload_json={
                    "type": "start_kyoku",
                    "bakaze": "E",
                    "kyoku": 1,
                    "honba": 0,
                    "kyotaku": 0,
                    "oya": 0,
                    "dora_marker": "1m",
                    "scores": [25000, 25000, 25000, 25000],
                    "tehais": [["?"] * 13, ["1m"] * 13, ["?"] * 13, ["?"] * 13],
                },
            ),
            SimpleNamespace(payload_json={"type": "ryukyoku"}),
            SimpleNamespace(payload_json={"type": "end_kyoku"}),
            SimpleNamespace(payload_json={"type": "end_kyoku"}),
        ]

        class ScalarRows:
            def all(self) -> list[SimpleNamespace]:
                return rows

        class StubSession:
            def __enter__(self) -> "StubSession":
                return self

            def __exit__(self, *args: object) -> None:
                return None

            def scalars(self, _statement: object) -> ScalarRows:
                return ScalarRows()

        with patch("app.play_launcher.SessionLocal", return_value=StubSession()):
            exported = MahjongAiLauncher(SimpleNamespace()).export_match_events_jsonl("match-id")

        events = parse_mjai_jsonl(exported)
        self.assertEqual(events[-2], {"type": "ryukyoku", "deltas": [0, 0, 0, 0]})
        self.assertEqual(events[-1], {"type": "end_kyoku"})


class FallbackReviewTests(unittest.TestCase):
    def test_fallback_review_keeps_internal_match_reviewable_without_engine(self) -> None:
        result = run_fallback_review(
            [
                {"type": "start_game"},
                {
                    "type": "start_kyoku",
                    "bakaze": "E",
                    "kyoku": 1,
                    "honba": 0,
                    "kyotaku": 0,
                    "oya": 0,
                    "scores": [25000, 25000, 25000, 25000],
                    "dora_marker": "2s",
                    "tehais": [
                        ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "4p"],
                        ["?"] * 13,
                        ["?"] * 13,
                        ["?"] * 13,
                    ],
                },
                {"type": "tsumo", "actor": 0, "pai": "1m"},
                {"type": "dahai", "actor": 0, "pai": "1m", "tsumogiri": True},
                {"type": "end_kyoku"},
            ],
            target_actor=0,
            reason="test",
        )

        self.assertEqual(result.engine_name, "mjai-reviewer-lite")
        self.assertEqual(result.summary["reviewed_decision_count"], 1)
        self.assertEqual(result.entries[0].decision_type, "discard")
        self.assertTrue(result.entries[0].is_match)
        table = result.entries[0].state_snapshot["table"]
        self.assertEqual(table["target_actor"], 0)
        self.assertEqual(table["dora_markers"], ["2s"])
        self.assertEqual(table["discards"][0][0]["pai"], "1m")
        self.assertEqual(
            table["hands"][0],
            ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "4p"],
        )


class MortalReviewDetailsTests(unittest.TestCase):
    def test_build_review_expands_mortal_q_values_into_candidate_details(self) -> None:
        events = [
            {
                "type": "start_kyoku",
                "bakaze": "E",
                "kyoku": 1,
                "honba": 0,
                "kyotaku": 0,
                "oya": 0,
                "scores": [25000, 25000, 25000, 25000],
                "dora_marker": "2s",
                "tehais": [
                    ["1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "2p", "3p", "4p"],
                    ["?"] * 13,
                    ["?"] * 13,
                    ["?"] * 13,
                ],
            },
            {"type": "tsumo", "actor": 0, "pai": "5p"},
            {"type": "dahai", "actor": 0, "pai": "1m", "tsumogiri": False},
        ]
        outputs = [
            {"type": "none", "meta": {"mask_bits": 0}},
            {
                "type": "reach",
                "actor": 0,
                "meta": {
                    "mask_bits": (1 << 0) | (1 << 1) | (1 << 2) | (1 << 37),
                    "q_values": [0.0, 1.0, 1.1, 1.2],
                    "shanten": 1,
                    "at_furiten": False,
                },
            },
            {"type": "none", "meta": {"mask_bits": 0}},
        ]

        result = build_review(events, outputs, {"model_tag": "test-model", "phi_matrix": []}, target_actor=0)

        details = result.entries[0].details
        self.assertEqual(len(details), 3)
        self.assertEqual([detail["expected_action"]["type"] for detail in details], ["reach", "dahai", "dahai"])
        self.assertEqual([detail["best_q_value"] for detail in details], [1.2, 1.1, 1.0])
        self.assertGreater(sum(detail["prob"] for detail in details), 0.99)
        self.assertLess(sum(detail["prob"] for detail in details), 1.0)
        self.assertTrue(all(detail["prob"] > 0.01 for detail in details))
        self.assertEqual(details[1]["expected_action"]["pai"], "3m")
        self.assertEqual(details[2]["expected_action"]["pai"], "2m")
        self.assertNotIn("1m", [detail["expected_action"].get("pai") for detail in details])


class PlayRecorderTests(unittest.TestCase):
    def test_target_actor_from_agents_finds_human_player_seat(self) -> None:
        agents = [
            {"username": "一姬1(简单)", "is_ai": True},
            {"username": "一姬2(简单)", "is_ai": True},
            {"username": "一姬3(简单)", "is_ai": True},
            {"username": "User1", "is_ai": False},
        ]

        self.assertEqual(target_actor_from_agents(agents, "User1"), 3)

    def test_target_actor_from_agents_returns_none_for_unknown_player(self) -> None:
        self.assertIsNone(target_actor_from_agents([{"username": "一姬1(简单)"}], "User1"))


    def test_start_kyoku_conversion_emits_mjai_compatible_shape(self) -> None:
        class TestLauncher(MahjongAiLauncher):
            def _update_match(self, match_id: str, status: str, result: dict | None = None) -> None:
                return None

            def _update_match_source(self, match_id: str, updates: dict) -> None:
                return None

        launcher = TestLauncher(SimpleNamespace())
        recorder = MatchRecorder(
            match_id="match-1",
            username="User1",
            host="127.0.0.1",
            port=0,
            stop_event=SimpleNamespace(),
        )
        launcher._recorder = recorder

        events = launcher._convert_protocol_event(
            recorder,
            {
                "event": "start",
                "game": {
                    "round": 0,
                    "honba": 0,
                    "riichi_ba": 0,
                    "oya": 0,
                    "dora_indicator": [104],
                    "agents": [
                        {"username": "AI1", "score": 250, "tile_count": 14, "is_ai": True},
                        {"username": "AI2", "score": 250, "tile_count": 13, "is_ai": True},
                        {"username": "AI3", "score": 250, "tile_count": 13, "is_ai": True},
                        {"username": "User1", "score": 250, "tile_count": 14, "is_ai": False},
                    ],
                },
                "self": {
                    "seat": 3,
                    "tiles": [31, 94, 33, 1, 4, 37, 108, 116, 78, 53, 21, 61, 73, 74],
                },
            },
        )

        start_kyoku = events[1]
        self.assertEqual(start_kyoku["dora_marker"], "9s")
        self.assertEqual(start_kyoku["scores"], [25000, 25000, 25000, 25000])
        self.assertEqual([len(hand) for hand in start_kyoku["tehais"]], [13, 13, 13, 14])

        normalized_events = normalize_internal_match_events_for_mjai(events)
        normalized_start_kyoku = normalized_events[1]
        self.assertEqual([len(hand) for hand in normalized_start_kyoku["tehais"]], [13, 13, 13, 13])
        self.assertEqual(normalized_events[2], {"type": "tsumo", "actor": 3, "pai": "1s"})

    def test_addkan_conversion_emits_single_valid_kakan(self) -> None:
        class TestLauncher(MahjongAiLauncher):
            def _update_match(self, match_id: str, status: str, result: dict | None = None) -> None:
                return None

            def _update_match_source(self, match_id: str, updates: dict) -> None:
                return None

        launcher = TestLauncher(SimpleNamespace())
        recorder = MatchRecorder(
            match_id="match-1",
            username="User1",
            host="127.0.0.1",
            port=0,
            stop_event=SimpleNamespace(),
            started=True,
        )

        addkan_events = launcher._convert_protocol_event(
            recorder,
            {"event": "addkan", "action": {"who": 1, "from_who": 1, "pattern": [2, 5, 23]}},
        )
        final_kan_events = launcher._convert_protocol_event(
            recorder,
            {"event": "kan", "action": {"who": 1, "from_who": 1, "pattern": [2, 5, 23]}},
        )

        self.assertEqual(
            addkan_events,
            [{"type": "kakan", "actor": 1, "pai": "6m", "consumed": ["6m", "6m", "6m"]}],
        )
        self.assertEqual(final_kan_events, [])

    def test_internal_match_normalization_adds_missing_terminal_deltas(self) -> None:
        events = normalize_internal_match_events_for_mjai(
            [
                {"type": "start_kyoku", "dora_marker": "1m", "tehais": [["?"] * 13] * 4},
                {"type": "hora", "actor": 0, "target": 1, "pai": "1m"},
                {"type": "ryukyoku"},
            ],
        )

        self.assertEqual(events[1]["deltas"], [0, 0, 0, 0])
        self.assertEqual(events[2]["deltas"], [0, 0, 0, 0])

    def test_internal_match_normalization_repairs_missing_dealer_initial_draw_for_ankan(self) -> None:
        events = normalize_internal_match_events_for_mjai(
            [
                {"type": "start_game"},
                {
                    "type": "start_kyoku",
                    "bakaze": "E",
                    "kyoku": 1,
                    "honba": 0,
                    "kyotaku": 0,
                    "oya": 0,
                    "scores": [25000, 25000, 25000, 25000],
                    "dora_marker": "2s",
                    "tehais": [
                        ["8m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "9m", "1p", "2p", "3p", "4p"],
                        ["?"] * 13,
                        ["?"] * 13,
                        ["?"] * 13,
                    ],
                },
                {"type": "dahai", "actor": 0, "pai": "1m", "tsumogiri": False},
                {"type": "tsumo", "actor": 0, "pai": "8m"},
                {"type": "dahai", "actor": 0, "pai": "2m", "tsumogiri": False},
                {"type": "tsumo", "actor": 0, "pai": "8m"},
                {"type": "ankan", "actor": 0, "target": 0, "pai": "?", "consumed": ["8m", "8m", "8m", "8m"]},
            ],
        )

        self.assertEqual(events[2], {"type": "tsumo", "actor": 0, "pai": "8m"})
        self.assertEqual(events[-1], {"type": "ankan", "actor": 0, "consumed": ["8m", "8m", "8m", "8m"]})

    def test_internal_match_normalization_repairs_legacy_kakan_shape(self) -> None:
        events = normalize_internal_match_events_for_mjai(
            [
                {"type": "start_kyoku", "tehais": [["?"] * 13, ["?"] * 13, ["?"] * 13, ["?"] * 13]},
                {"type": "kakan", "actor": 1, "target": 1, "pai": "?", "consumed": ["6m"]},
                {"type": "kakan", "actor": 1, "target": 1, "pai": "?", "consumed": []},
            ],
        )

        self.assertEqual(
            [event for event in events if event.get("type") == "kakan"],
            [{"type": "kakan", "actor": 1, "pai": "6m", "consumed": ["6m", "6m", "6m"]}],
        )

    def test_reaction_window_does_not_match_future_discard(self) -> None:
        events = [
            {"type": "start_kyoku"},
            {"type": "dahai", "actor": 1, "pai": "9m", "tsumogiri": False},
            {"type": "tsumo", "actor": 2, "pai": "8s"},
            {"type": "dahai", "actor": 2, "pai": "F", "tsumogiri": False},
        ]

        self.assertIsNone(next_actual_action(events, 1, 2))
        self.assertEqual(next_actual_action(events, 2, 2), events[3])


class PlayReviewEndpointTests(unittest.TestCase):
    def test_create_play_match_review_uses_recorded_target_actor_and_event_snapshot(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            engine = create_engine(f"sqlite:///{db_path.as_posix()}")
            Base.metadata.create_all(bind=engine)
            TestingSession = sessionmaker(bind=engine)
            db = TestingSession()
            old_enqueue = main_app.enqueue_review_job
            main_app.enqueue_review_job = lambda job_id: None
            try:
                user = User(display_name="Tester")
                db.add(user)
                db.commit()
                db.refresh(user)
                match = Match(
                    user_id=user.id,
                    status="round_finished",
                    source_json={"username": "User1", "target_actor": 3, "target_player_label": "User1"},
                )
                db.add(match)
                db.commit()
                db.refresh(match)
                db.add_all(
                    [
                        MatchEvent(match_id=match.id, seq=0, event_type="start_game", payload_json={"type": "start_game"}),
                        MatchEvent(
                            match_id=match.id,
                            seq=1,
                            event_type="start_kyoku",
                            payload_json={"type": "start_kyoku", "honba": 0},
                        ),
                        MatchEvent(match_id=match.id, seq=2, event_type="end_kyoku", payload_json={"type": "end_kyoku"}),
                    ],
                )
                db.commit()

                job = main_app.create_play_match_review(match.id, db)

                self.assertEqual(job.source_type, "internal_match")
                self.assertEqual(job.target_player_ref, "3")
                created_job = db.get(ReviewJob, job.id)
                self.assertIsNotNone(created_job)
                self.assertEqual(created_job.match_id, match.id)
                self.assertEqual(created_job.source_payload["event_limit"], 3)

                same_snapshot_job = main_app.create_play_match_review(match.id, db)
                self.assertEqual(same_snapshot_job.id, job.id)

                match.status = "running"
                db.add(MatchEvent(match_id=match.id, seq=3, event_type="tsumo", payload_json={"type": "tsumo"}))
                db.commit()
                still_same_snapshot_job = main_app.create_play_match_review(match.id, db)
                self.assertEqual(still_same_snapshot_job.id, job.id)
                self.assertEqual(db.get(Match, match.id).status, "round_finished")

                db.add(MatchEvent(match_id=match.id, seq=4, event_type="end_kyoku", payload_json={"type": "end_kyoku"}))
                db.commit()
                next_snapshot_job = main_app.create_play_match_review(match.id, db)
                self.assertNotEqual(next_snapshot_job.id, job.id)
                next_created_job = db.get(ReviewJob, next_snapshot_job.id)
                self.assertEqual(next_created_job.source_payload["event_limit"], 5)
            finally:
                main_app.enqueue_review_job = old_enqueue
                db.close()
                engine.dispose()

    def test_list_play_matches_returns_serialized_training_history(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            engine = create_engine(f"sqlite:///{db_path.as_posix()}")
            Base.metadata.create_all(bind=engine)
            TestingSession = sessionmaker(bind=engine)
            db = TestingSession()
            try:
                user = User(display_name="Tester")
                db.add(user)
                db.commit()
                db.refresh(user)
                match = Match(
                    user_id=user.id,
                    status="completed",
                    match_type="hanchan",
                    source_json={"username": "User1", "ai_level": "normal", "target_actor": 0},
                    result_json={"score": [[0, 320], [1, 250], [2, 220], [3, 210]]},
                )
                db.add(match)
                db.commit()
                db.refresh(match)
                db.add_all(
                    [
                        MatchEvent(match_id=match.id, seq=0, event_type="start_game", payload_json={"type": "start_game"}),
                        MatchEvent(match_id=match.id, seq=1, event_type="end_kyoku", payload_json={"type": "end_kyoku"}),
                        ReviewJob(
                            user_id=user.id,
                            match_id=match.id,
                            status="completed",
                            source_type="internal_match",
                            source_payload={"event_limit": 2},
                            options_json={},
                            attempt_count=1,
                        ),
                    ],
                )
                db.commit()

                page = main_app.list_play_matches(q=None, status_filter=None, page=1, page_size=10, db=db)

                self.assertEqual(page.total, 1)
                self.assertEqual(page.items[0].id, match.id)
                self.assertEqual(page.items[0].match_type, "hanchan")
                self.assertEqual(page.items[0].event_count, 2)
                self.assertEqual(page.items[0].completed_kyoku_count, 1)
                self.assertEqual(page.items[0].latest_review_job.status, "completed")

                running_match = Match(
                    user_id=user.id,
                    status="running",
                    match_type="hanchan",
                    source_json={"username": "User1", "ai_level": "normal", "target_actor": 0},
                )
                db.add(running_match)
                db.commit()
                db.refresh(running_match)
                db.add(MatchEvent(match_id=running_match.id, seq=0, event_type="end_kyoku", payload_json={"type": "end_kyoku"}))
                db.commit()

                round_finished_page = main_app.list_play_matches(
                    q=None,
                    status_filter="round_finished",
                    page=1,
                    page_size=10,
                    db=db,
                )
                self.assertEqual(round_finished_page.total, 1)
                self.assertEqual(round_finished_page.items[0].id, running_match.id)
            finally:
                db.close()
                engine.dispose()

    def test_internal_match_event_limit_loads_snapshot_only(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            engine = create_engine(f"sqlite:///{db_path.as_posix()}")
            Base.metadata.create_all(bind=engine)
            TestingSession = sessionmaker(bind=engine)
            db = TestingSession()
            try:
                user = User(display_name="Tester")
                db.add(user)
                db.commit()
                db.refresh(user)
                match = Match(user_id=user.id, status="round_finished", source_json={})
                db.add(match)
                db.commit()
                db.refresh(match)
                db.add_all(
                    [
                        MatchEvent(match_id=match.id, seq=0, event_type="start_game", payload_json={"type": "start_game"}),
                        MatchEvent(
                            match_id=match.id,
                            seq=1,
                            event_type="start_kyoku",
                            payload_json={"type": "start_kyoku"},
                        ),
                        MatchEvent(match_id=match.id, seq=2, event_type="end_kyoku", payload_json={"type": "end_kyoku"}),
                    ],
                )
                db.commit()

                job = SimpleNamespace(
                    source_type="internal_match",
                    source_payload={"match_id": match.id, "event_limit": 2},
                    match_id=match.id,
                )

                events = load_events_for_job(db, job)

                self.assertEqual([event["type"] for event in events], ["start_game", "start_kyoku"])
            finally:
                db.close()
                engine.dispose()

    def test_internal_match_loader_normalizes_recorded_start_kyoku(self) -> None:
        with TemporaryDirectory() as temp_dir:
            db_path = Path(temp_dir) / "test.db"
            engine = create_engine(f"sqlite:///{db_path.as_posix()}")
            Base.metadata.create_all(bind=engine)
            TestingSession = sessionmaker(bind=engine)
            db = TestingSession()
            try:
                user = User(display_name="Tester")
                db.add(user)
                db.commit()
                db.refresh(user)
                match = Match(user_id=user.id, status="round_finished", source_json={})
                db.add(match)
                db.commit()
                db.refresh(match)
                db.add(
                    MatchEvent(
                        match_id=match.id,
                        seq=0,
                        event_type="start_kyoku",
                        payload_json={
                            "type": "start_kyoku",
                            "bakaze": "E",
                            "kyoku": 1,
                            "honba": 0,
                            "kyotaku": 0,
                            "oya": 0,
                            "dora_marker": ["9s"],
                            "scores": [25000, 25000, 25000, 25000],
                            "tehais": [["?"] * 14, ["?"] * 13, ["?"] * 13, ["1m"] * 14],
                        },
                    ),
                )
                db.commit()
                job = SimpleNamespace(
                    source_type="internal_match",
                    source_payload={"match_id": match.id},
                    match_id=match.id,
                )

                events = load_events_for_job(db, job)

                self.assertEqual(events[0]["dora_marker"], "9s")
                self.assertEqual([len(hand) for hand in events[0]["tehais"]], [13, 13, 13, 13])
                self.assertEqual(events[1], {"type": "tsumo", "actor": 0, "pai": "?"})
                self.assertEqual(events[2], {"type": "tsumo", "actor": 3, "pai": "1m"})
            finally:
                db.close()
                engine.dispose()


if __name__ == "__main__":
    unittest.main()
