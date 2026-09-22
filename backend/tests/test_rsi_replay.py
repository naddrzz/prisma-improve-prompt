"""Iteration-2: deterministic RSI + Replay tests. No live LLM calls.

Uses async fixtures to simulate the streaming LLM source. Tests exercise
rsi.automatic_rsi and replay.evaluate_replay directly plus the public
/api/replay/evaluate endpoint via REACT_APP_BACKEND_URL.
"""
import os
import sys
import json
import copy
import asyncio
import uuid
from pathlib import Path

import pytest
import requests
from fastapi import HTTPException
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import replay as replay_mod
import rsi as rsi_mod
from rsi import automatic_rsi, EVALUATOR_SYSTEM, Evaluation, MAX_LLM_CALLS
from replay import (
    RecordedNode, ReplayWorld, ReplayRequest, evaluate_replay,
    select_batch, replay_world,
)

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

# ---------- helpers ----------

def _eval_json(clarity=5, intent=5, cf=5, usability=5, preserved=True, violations=None, summary="ok"):
    return json.dumps({
        "clarity": clarity, "intent": intent, "constraint_fidelity": cf, "usability": usability,
        "constraints_preserved": preserved, "violations": violations or [], "summary": summary,
    })


def _cand_json(text):
    return json.dumps({"final_prompt": text})


def make_source(script):
    """script: list of strings returned by successive calls to source()."""
    counter = {"n": 0, "systems": [], "phase_ids": []}

    async def source(system, user, phase_id, max_tokens, temperature):
        counter["systems"].append(system)
        counter["phase_ids"].append(phase_id)
        i = counter["n"]
        counter["n"] += 1
        chunk = script[i]
        for piece in (chunk[:20], chunk[20:]):
            if piece:
                yield piece

    return source, counter


def parse_result(raw):
    data = json.loads(raw)
    return {"final_prompt": data["final_prompt"]}


def extract_json(raw):
    return json.loads(raw)


def partial(buf):
    return ""


async def _collect(gen):
    events = []
    async for e in gen:
        events.append(e)
    return events


# ============================================================
# RSI tests
# ============================================================

class TestRSICallBudget:
    def test_happy_path_exactly_8_calls_and_status_stages(self):
        # 4 gens + 4 evals; all constraints preserved with different scores.
        script = [
            _cand_json("A"), _eval_json(clarity=3, intent=3, cf=3, usability=3),  # a
            _cand_json("B"), _eval_json(clarity=4, intent=4, cf=4, usability=4),  # b (best under parallel_refine)
            _cand_json("C"), _eval_json(clarity=2, intent=2, cf=2, usability=2),  # c
            _cand_json("D"), _eval_json(clarity=5, intent=5, cf=5, usability=5),  # d
        ]
        source, counter = make_source(script)
        events = asyncio.run(_collect(automatic_rsi(
            system="SYS", user="USER", history=[], current_policy="parallel_refine",
            session_id=uuid.uuid4(), source=source, parse_result=parse_result,
            extract_json=extract_json, partial_prompt=partial,
        )))
        assert counter["n"] == 8  # exact cap: 4 generate + 4 evaluate

        # Every evaluate call must use the fixed rubric verbatim.
        eval_systems = [s for s, pid in zip(counter["systems"], counter["phase_ids"]) if pid.endswith("-evaluate")]
        assert len(eval_systems) == 4
        for s in eval_systems:
            assert s == EVALUATOR_SYSTEM

        # Result event exists and reports the budget correctly.
        result = next(e for e in events if e["type"] == "result")["data"]
        r = result["rsi"]
        assert r["enabled"] is True
        assert r["actual_llm_calls"] == 8
        assert r["max_llm_calls"] == MAX_LLM_CALLS
        assert r["candidate_count"] == 4
        assert r["online_applied"] is True
        assert r["replay_llm_calls"] == 0
        assert r["evaluator"] == "prisma-rubric-v1"
        assert r["policy_search"] == "handwritten_presets_not_generated_code"
        # Selected candidate must be the highest scoring, not the last streamed.
        assert result["final_prompt"] == "D"
        assert r["selected_candidate"] == "d"
        assert abs(r["selected_score"] - 1.0) < 1e-9

        # Status stages present in order
        stages = [e["stage"] for e in events if e["type"] == "status"]
        assert stages[:3] == ["generate", "evaluate", "generate"]
        assert "replay" in stages
        assert stages[-1] == "select"


class TestRSISelectedPolicyChangesParent:
    def test_online_action_parent_matches_selected_policy(self):
        # 'a' terminal (evaluated), 'b' continues 'a', 'c' independent root, all valid.
        # Give scores so quality_first > parallel_refine on the frozen world:
        #   world: a(0.2), b(parent=a, 0.9), c(0.4)
        # parallel_refine would pick the shallowest leaf (c or b tie by depth 1);
        # quality_first picks highest-score leaf, which is b => parent_id of D is 'b'.
        script = [
            _cand_json("A"), _eval_json(clarity=1, intent=1, cf=1, usability=1),  # a=0.2
            _cand_json("B"), _eval_json(clarity=5, intent=4, cf=5, usability=4),  # b=0.9
            _cand_json("C"), _eval_json(clarity=2, intent=2, cf=2, usability=2),  # c=0.4
            _cand_json("D_from_b"), _eval_json(clarity=5, intent=5, cf=5, usability=5),
        ]
        source, counter = make_source(script)
        events = asyncio.run(_collect(automatic_rsi(
            system="SYS", user="USER", history=[], current_policy="parallel_refine",
            session_id=uuid.uuid4(), source=source, parse_result=parse_result,
            extract_json=extract_json, partial_prompt=partial,
        )))
        result = next(e for e in events if e["type"] == "result")["data"]
        r = result["rsi"]
        # The fourth generation's parent must equal what select_batch of the
        # selected policy chose over the frozen 3-node world (proves policy steers parent).
        frozen_nodes = [RecordedNode(**n) for n in r["world"]["nodes"] if n["id"] in ("a", "b", "c")]
        observed = {n.id: n for n in frozen_nodes}
        parents = {n.parent_id for n in frozen_nodes}
        legal = [None, *(n.id for n in frozen_nodes if n.id not in parents)]
        expected = select_batch(r["selected_policy"], observed, legal, 1, 0)
        expected_parent = expected[0] if expected else None
        assert r["online_action"]["parent_id"] == expected_parent
        assert r["online_action"]["operation"] == ("continue" if expected else "stop")
        d_node = next(n for n in r["world"]["nodes"] if n["id"] == "d")
        assert d_node["parent_id"] == expected_parent


class TestRSIMalformedEvaluator:
    def test_bad_evaluator_json_raises_ai_bad_evaluation(self):
        script = [
            _cand_json("A"), "not json at all",
        ]
        source, _ = make_source(script)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(_collect(automatic_rsi(
                system="SYS", user="USER", history=[], current_policy="parallel_refine",
                session_id=uuid.uuid4(), source=source, parse_result=parse_result,
                extract_json=extract_json, partial_prompt=partial,
            )))
        assert exc.value.detail == "AI_BAD_EVALUATION"
        assert exc.value.status_code == 502

    def test_evaluator_out_of_range_raises_ai_bad_evaluation(self):
        script = [
            _cand_json("A"), _eval_json(clarity=9),  # 9 > 5, ValidationError
        ]
        source, _ = make_source(script)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(_collect(automatic_rsi(
                system="SYS", user="USER", history=[], current_policy="parallel_refine",
                session_id=uuid.uuid4(), source=source, parse_result=parse_result,
                extract_json=extract_json, partial_prompt=partial,
            )))
        assert exc.value.detail == "AI_BAD_EVALUATION"


class TestRSIAllConstraintsFailed:
    def test_no_passing_candidate_raises(self):
        script = [
            _cand_json("A"), _eval_json(preserved=False, violations=["bad"]),
            _cand_json("B"), _eval_json(preserved=True, violations=["x"]),  # non-empty violations => score 0 but valid list; considered invalid
            _cand_json("C"), _eval_json(preserved=False),
            _cand_json("D"), _eval_json(preserved=False, violations=["y"]),
        ]
        source, _ = make_source(script)
        with pytest.raises(HTTPException) as exc:
            asyncio.run(_collect(automatic_rsi(
                system="SYS", user="USER", history=[], current_policy="parallel_refine",
                session_id=uuid.uuid4(), source=source, parse_result=parse_result,
                extract_json=extract_json, partial_prompt=partial,
            )))
        assert exc.value.detail == "RSI_CONSTRAINTS_FAILED"


class TestRSIBadCandidateJSON:
    def test_bad_candidate_bubbles_up(self):
        def bad_parse(_raw):
            raise ValueError("bad")

        script = ["garbage that will not parse"]
        source, _ = make_source(script)
        with pytest.raises(ValueError):
            asyncio.run(_collect(automatic_rsi(
                system="SYS", user="USER", history=[], current_policy="parallel_refine",
                session_id=uuid.uuid4(), source=source, parse_result=bad_parse,
                extract_json=extract_json, partial_prompt=partial,
            )))


class TestRSIHistoryPassedToReplay:
    def test_history_worlds_forwarded(self, monkeypatch):
        seen = {}

        real_eval = rsi_mod.evaluate_replay

        def capture(req):
            seen["req"] = req
            return real_eval(req)

        monkeypatch.setattr(rsi_mod, "evaluate_replay", capture)

        prior_world = ReplayWorld(id="prev", nodes=[
            RecordedNode(id="p1", parent_id=None, score=0.5),
            RecordedNode(id="p2", parent_id="p1", score=0.6),
        ])
        script = [
            _cand_json("A"), _eval_json(clarity=3, intent=3, cf=3, usability=3),
            _cand_json("B"), _eval_json(clarity=4, intent=4, cf=4, usability=4),
            _cand_json("C"), _eval_json(clarity=2, intent=2, cf=2, usability=2),
            _cand_json("D"), _eval_json(clarity=5, intent=5, cf=5, usability=5),
        ]
        source, _ = make_source(script)
        events = asyncio.run(_collect(automatic_rsi(
            system="SYS", user="USER", history=[prior_world], current_policy="quality_first",
            session_id=uuid.uuid4(), source=source, parse_result=parse_result,
            extract_json=extract_json, partial_prompt=partial,
        )))
        assert len(seen["req"].worlds) == 2  # prior + frozen
        assert seen["req"].worlds[0].id == "prev"
        assert seen["req"].current_policy == "quality_first"
        result = next(e for e in events if e["type"] == "result")["data"]
        assert result["rsi"]["replay_world_count"] == 2


# ============================================================
# Replay tests
# ============================================================

class TestReplayEquation:
    def test_value_equation_and_worlds_mean(self):
        # single world, all nodes revealed in 3 rounds with workers=1
        world = ReplayWorld(id="w1", nodes=[
            RecordedNode(id="a", parent_id=None, score=0.4),
            RecordedNode(id="b", parent_id="a", score=0.7),
            RecordedNode(id="c", parent_id="b", score=0.9),
        ])
        req = ReplayRequest(session_id=uuid.uuid4(), worlds=[world],
                            current_policy="parallel_refine", workers=1,
                            max_rounds=10, beta1=0.02, beta2=0.05)
        out = replay_world(world, "parallel_refine", req)
        # best=0.9, N=3 calls, k=3 rounds  =>  0.9 - 0.02*3 + 0.05*3/3 = 0.89
        assert abs(out["score"] - 0.89) < 1e-9
        assert out["best_score"] == 0.9
        assert out["represented_calls"] == 3
        assert out["rounds"] == 3

    def test_mean_over_worlds(self):
        w1 = ReplayWorld(id="w1", nodes=[RecordedNode(id="a", score=0.4), RecordedNode(id="b", parent_id="a", score=0.6)])
        w2 = ReplayWorld(id="w2", nodes=[RecordedNode(id="a", score=0.8), RecordedNode(id="b", parent_id="a", score=0.9)])
        req = ReplayRequest(session_id=uuid.uuid4(), worlds=[w1, w2],
                            current_policy="parallel_refine", beta1=0, beta2=0)
        out = evaluate_replay(req)
        pr = next(r for r in out["results"] if r["policy"] == "parallel_refine")
        # world1 best=0.6, world2 best=0.9, mean=0.75
        assert abs(pr["mean_score"] - 0.75) < 1e-9


class TestReplayPrefixOnly:
    def test_hidden_score_change_does_not_leak_into_decision(self):
        # Two children of root exist; unrevealed sibling's score should not affect
        # which child gets revealed first under any policy (they only see legal parents).
        w = ReplayWorld(id="w", nodes=[
            RecordedNode(id="a", score=0.1),
            RecordedNode(id="b", score=0.2),  # sibling root child not directly reachable (parent must precede)
        ])
        # Actually schema requires parent to precede; roots are those with None parent. Only 'a' is a root here.
        # Build a proper prefix test: two roots... schema allows multiple None-parent nodes.
        w2 = ReplayWorld(id="w2", nodes=[
            RecordedNode(id="a", score=0.9),
            RecordedNode(id="b", score=0.1),
        ])
        req_a = ReplayRequest(session_id=uuid.uuid4(), worlds=[w2], current_policy="parallel_refine",
                              workers=1, max_rounds=1, beta1=0, beta2=0)
        out_a = replay_world(w2, "parallel_refine", req_a)
        chosen_first = out_a["trajectory"][0]["revealed"][0]["id"]
        # Flip scores; decisions should be identical because policy sees legal parents (None) only.
        w3 = ReplayWorld(id="w3", nodes=[
            RecordedNode(id="a", score=0.1),
            RecordedNode(id="b", score=0.9),
        ])
        req_b = ReplayRequest(session_id=uuid.uuid4(), worlds=[w3], current_policy="parallel_refine",
                              workers=1, max_rounds=1, beta1=0, beta2=0)
        out_b = replay_world(w3, "parallel_refine", req_b)
        assert chosen_first == out_b["trajectory"][0]["revealed"][0]["id"]


class TestReplayImmutableAndReset:
    def test_input_worlds_not_mutated(self):
        w = ReplayWorld(id="w", nodes=[RecordedNode(id="a", score=0.5), RecordedNode(id="b", parent_id="a", score=0.6)])
        req = ReplayRequest(session_id=uuid.uuid4(), worlds=[w], current_policy="parallel_refine")
        snapshot = w.model_dump()
        evaluate_replay(req)
        assert w.model_dump() == snapshot

    def test_no_parent_and_child_same_batch(self):
        w = ReplayWorld(id="w", nodes=[
            RecordedNode(id="a", score=0.4),
            RecordedNode(id="b", parent_id="a", score=0.6),
            RecordedNode(id="c", parent_id="b", score=0.8),
        ])
        req = ReplayRequest(session_id=uuid.uuid4(), worlds=[w],
                            current_policy="parallel_refine", workers=8, max_rounds=10, beta1=0, beta2=0)
        out = replay_world(w, "parallel_refine", req)
        for ev in out["trajectory"]:
            ids = [r["id"] for r in ev["revealed"]]
            # No revealed node's parent appears in the same batch
            parents = {r["parent_id"] for r in ev["revealed"] if r["parent_id"]}
            assert parents.isdisjoint(set(ids))


class TestReplayCaps:
    def test_max_rounds_cap(self):
        # Chain of 5 nodes, cap rounds at 2 => only 2 revealed
        nodes = [RecordedNode(id="a", score=0.1)]
        for i, prev in enumerate(["a", "b", "c", "d"]):
            nodes.append(RecordedNode(id=chr(ord("b") + i), parent_id=prev, score=0.2 + i * 0.1))
        w = ReplayWorld(id="w", nodes=nodes)
        req = ReplayRequest(session_id=uuid.uuid4(), worlds=[w], current_policy="parallel_refine",
                            workers=1, max_rounds=2, beta1=0, beta2=0)
        out = replay_world(w, "parallel_refine", req)
        assert out["rounds"] == 2
        assert out["represented_calls"] == 2
        assert out["stop_reason"] == "round_limit"

    def test_support_exhausted(self):
        w = ReplayWorld(id="w", nodes=[RecordedNode(id="a", score=0.5), RecordedNode(id="b", parent_id="a", score=0.6)])
        req = ReplayRequest(session_id=uuid.uuid4(), worlds=[w], current_policy="parallel_refine",
                            workers=1, max_rounds=99, beta1=0, beta2=0)
        out = replay_world(w, "parallel_refine", req)
        assert out["stop_reason"] == "support_exhausted"


class TestReplaySchema:
    def test_duplicate_ids_rejected(self):
        with pytest.raises(ValidationError):
            ReplayWorld(id="w", nodes=[RecordedNode(id="a", score=0.1), RecordedNode(id="a", score=0.2)])

    def test_future_parent_rejected(self):
        with pytest.raises(ValidationError):
            ReplayWorld(id="w", nodes=[RecordedNode(id="a", parent_id="b", score=0.1), RecordedNode(id="b", score=0.2)])

    def test_multiple_children_non_root_rejected(self):
        with pytest.raises(ValidationError):
            ReplayWorld(id="w", nodes=[
                RecordedNode(id="a", score=0.1),
                RecordedNode(id="b", parent_id="a", score=0.2),
                RecordedNode(id="c", parent_id="a", score=0.3),
            ])

    def test_score_out_of_range_rejected(self):
        with pytest.raises(ValidationError):
            RecordedNode(id="a", score=1.5)
        with pytest.raises(ValidationError):
            RecordedNode(id="a", score=-0.1)

    def test_nonfinite_score_rejected(self):
        with pytest.raises(ValidationError):
            RecordedNode(id="a", score=float("nan"))

    def test_duplicate_worlds_rejected(self):
        w = ReplayWorld(id="dup", nodes=[RecordedNode(id="a", score=0.1), RecordedNode(id="b", parent_id="a", score=0.2)])
        with pytest.raises(ValidationError):
            ReplayRequest(session_id=uuid.uuid4(), worlds=[w, w])

    def test_excess_nodes_rejected(self):
        nodes = [RecordedNode(id=f"n{i}", parent_id=(f"n{i-1}" if i else None), score=0.1) for i in range(21)]
        with pytest.raises(ValidationError):
            ReplayWorld(id="big", nodes=nodes)

    def test_invalid_uuid_rejected(self):
        with pytest.raises(ValidationError):
            ReplayRequest(session_id="not-a-uuid", worlds=[
                ReplayWorld(id="w", nodes=[RecordedNode(id="a", score=0.1), RecordedNode(id="b", parent_id="a", score=0.2)])
            ])

    def test_extra_fields_rejected(self):
        with pytest.raises(ValidationError):
            RecordedNode(id="a", score=0.1, api_key="sk-x")
        with pytest.raises(ValidationError):
            ReplayWorld(id="w", nodes=[RecordedNode(id="a", score=0.1)], api_key="sk-x")
        with pytest.raises(ValidationError):
            ReplayRequest(session_id=uuid.uuid4(),
                          worlds=[ReplayWorld(id="w", nodes=[RecordedNode(id="a", score=0.1),
                                                             RecordedNode(id="b", parent_id="a", score=0.2)])],
                          code="print(1)")


class TestReplayIncumbentTie:
    def test_incumbent_wins_ties(self):
        # Identical world => all policies produce equal mean_score. current_policy wins.
        w = ReplayWorld(id="w", nodes=[
            RecordedNode(id="a", score=0.5),
            RecordedNode(id="b", parent_id="a", score=0.5),
        ])
        req = ReplayRequest(session_id=uuid.uuid4(), worlds=[w], current_policy="patient",
                            workers=1, max_rounds=10, beta1=0, beta2=0)
        out = evaluate_replay(req)
        assert out["selected_policy"] == "patient"
        assert out["replay_gain"] == 0


class TestReplayEndpoint:
    def test_endpoint_returns_no_llm_calls(self):
        payload = {
            "session_id": str(uuid.uuid4()),
            "worlds": [{
                "id": "w1",
                "nodes": [
                    {"id": "a", "parent_id": None, "score": 0.4},
                    {"id": "b", "parent_id": "a", "score": 0.7},
                ],
            }],
            "current_policy": "parallel_refine",
        }
        r = requests.post(f"{BASE_URL}/api/replay/evaluate", json=payload, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["actual_llm_calls"] == 0
        assert d["online_deployed"] is False
        assert d["policy_search"] == "handwritten_presets"
        assert set(POLICIES := {"parallel_refine", "breadth_first", "quality_first", "patient"}) == {r["policy"] for r in d["results"]}

    def test_endpoint_rejects_extra_fields(self):
        payload = {
            "session_id": str(uuid.uuid4()),
            "worlds": [{"id": "w1", "nodes": [
                {"id": "a", "parent_id": None, "score": 0.4},
                {"id": "b", "parent_id": "a", "score": 0.5},
            ]}],
            "api_key": "sk-should-reject",
        }
        r = requests.post(f"{BASE_URL}/api/replay/evaluate", json=payload, timeout=15)
        assert r.status_code == 422

    def test_endpoint_needs_two_nodes(self):
        payload = {
            "session_id": str(uuid.uuid4()),
            "worlds": [{"id": "w1", "nodes": [{"id": "a", "parent_id": None, "score": 0.4}]}],
        }
        r = requests.post(f"{BASE_URL}/api/replay/evaluate", json=payload, timeout=15)
        assert r.status_code == 422
        assert r.json()["detail"] == "REPLAY_NEEDS_TWO_NODES"


# Paper analysis download
class TestPaperArtifact:
    def test_dream_rsi_prisma_md_served(self):
        r = requests.get(f"{BASE_URL}/dream-rsi-prisma.md", timeout=20)
        assert r.status_code == 200
        assert "RSI" in r.text or "Dream" in r.text
