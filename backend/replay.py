"""Bounded, prefix-only historical replay; Dream-RSI section 3, equation (1).

The policies below are hand-written comparison presets, not the paper's learned
OptimalPolicy. No provider calls, generated-code execution, or session persistence.
"""
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

Policy = Literal["parallel_refine", "breadth_first", "quality_first", "patient"]
POLICIES = ("parallel_refine", "breadth_first", "quality_first", "patient")
router = APIRouter(prefix="/api/replay", tags=["historical replay"])


class RecordedNode(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    id: str = Field(min_length=1, max_length=80)
    parent_id: str | None = Field(default=None, max_length=80)
    score: float = Field(ge=0, le=1, allow_inf_nan=False)


class ReplayWorld(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=80)
    baseline_score: float = Field(default=0, ge=0, le=1, allow_inf_nan=False)
    nodes: list[RecordedNode] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_tree(self):
        seen, continued = set(), set()
        for node in self.nodes:
            if node.id in seen:
                raise ValueError("DUPLICATE_NODE")
            if node.parent_id is not None:
                if node.parent_id not in seen:
                    raise ValueError("PARENT_MUST_PRECEDE_CHILD")
                if node.parent_id in continued:
                    raise ValueError("NON_ROOT_MUST_HAVE_ONE_CONTINUATION")
                continued.add(node.parent_id)
            seen.add(node.id)
        return self


class ReplayRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    session_id: UUID
    worlds: list[ReplayWorld] = Field(min_length=1, max_length=20)
    current_policy: Policy = "parallel_refine"
    workers: int = Field(default=1, ge=1, le=8)
    max_rounds: int = Field(default=20, ge=1, le=100)
    beta1: float = Field(default=0.02, ge=0, le=1, allow_inf_nan=False)
    beta2: float = Field(default=0, ge=0, le=1, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_pool(self):
        if len({w.id for w in self.worlds}) != len(self.worlds):
            raise ValueError("DUPLICATE_WORLD")
        if sum(len(w.nodes) for w in self.worlds) > 100:
            raise ValueError("MAX_100_NODES")
        return self


def _trajectory(parent_id, observed):
    path = []
    while parent_id is not None:
        node = observed[parent_id]
        path.append(node.score)
        parent_id = node.parent_id
    return list(reversed(path))


def select_batch(policy, observed, legal, workers, baseline):
    """Only revealed observations and legal parent IDs cross this boundary.

    The virtual root (None) is one action per batch, following section 3.
    Equal priorities use observation order; never a hidden score or winning ID.
    """
    actions = list(legal)
    paths = {p: _trajectory(p, observed) for p in actions}
    if policy == "patient":
        def promising(parent):
            scores = [baseline] + paths[parent]
            gains = [b - a for a, b in zip(scores, scores[1:])]
            return parent is None or len(gains) < 2 or any(g > 0 for g in gains[-2:])
        actions = [p for p in actions if promising(p)]
    if policy == "breadth_first":
        actions.sort(key=lambda p: (p is not None, len(paths[p])))
    elif policy in ("quality_first", "patient"):
        actions.sort(key=lambda p: -(observed[p].score if p is not None else baseline))
    else:
        actions.sort(key=lambda p: (p is None, len(paths[p])))
    return actions[:workers]


def replay_world(world: ReplayWorld, policy: Policy, req: ReplayRequest):
    children = {}
    for node in world.nodes:
        children.setdefault(node.parent_id, []).append(node)
    observed, rounds, events = {}, 0, []
    best, calls = world.baseline_score, 0
    stop_reason = "round_limit"
    while rounds < req.max_rounds:
        # A non-root continuation is legal only at a revealed leaf. The root
        # remains legal until all of its recorded branches have been consumed.
        parents = {n.parent_id for n in observed.values()}
        legal = [p for p in [None, *observed]
                 if (p is None or p not in parents)
                 and any(n.id not in observed for n in children.get(p, []))]
        if not legal:
            stop_reason = "support_exhausted"
            break
        batch = select_batch(policy, dict(observed), legal, req.workers, world.baseline_score)
        if not batch:
            stop_reason = "policy_stop"
            break
        # Freeze the batch before revealing outcomes: no parent+child in one round.
        revealed = [next(n for n in children[p] if n.id not in observed) for p in batch]
        for node in revealed:
            observed[node.id] = node
            best = max(best, node.score)
        calls += len(revealed)
        rounds += 1
        events.append({"round": rounds, "actions": batch,
                       "revealed": [n.model_dump() for n in revealed], "best_score": best})
    value = best - req.beta1 * calls + req.beta2 * calls / max(1, rounds)
    return {"world_id": world.id, "score": value, "best_score": best,
            "represented_calls": calls, "rounds": rounds,
            "mean_batch_size": calls / max(1, rounds),
            "stop_reason": stop_reason, "trajectory": events}


@router.post("/evaluate")
def evaluate_replay(req: ReplayRequest):
    if sum(len(w.nodes) for w in req.worlds) < 2:
        raise HTTPException(status_code=422, detail="REPLAY_NEEDS_TWO_NODES")
    ordered = [req.current_policy, *(p for p in POLICIES if p != req.current_policy)]
    results = []
    for policy in ordered:
        worlds = [replay_world(w, policy, req) for w in req.worlds]
        results.append({"policy": policy, "mean_score": sum(w["score"] for w in worlds) / len(worlds),
                        "worlds": worlds})
    # Incumbent wins ties. The guarantee applies only to this fixed historical pool.
    winner = max(results, key=lambda row: row["mean_score"])
    return {"session_id": str(req.session_id), "objective": "dream-rsi-section-3-equation-1",
            "current_policy": req.current_policy, "selected_policy": winner["policy"],
            "replay_gain": winner["mean_score"] - results[0]["mean_score"],
            "actual_llm_calls": 0, "results": results,
            "scope": "recorded_support_only", "policy_search": "handwritten_presets",
            "online_deployed": False}
