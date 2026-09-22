"""Mock OpenAI-compatible provider to exercise the RSI evaluation path."""
import json
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()
state = {"eval_calls": 0}

GEN = {
    "final_prompt": "Tulis artikel 600 kata tentang energi terbarukan untuk pemula, gaya ramah.",
    "explanation": "Ditambahkan audiens, panjang, dan gaya.",
    "changes": ["menambahkan panjang"], "assumptions": [], "open_questions": [],
    "clarifying_questions": [], "directions": [],
}

EVALS = [
    'blah blah, here is nothing parseable at all',  # forces retry
    '<think>weighing options</think>\n{"clarity":"4","intent":4,"constraint_fidelity":"5/5",'
    '"usability":4,"constraints_preserved":"yes","violations":"none","summary":"kuat"}',
    'Sure!\n```json\n{"clarity":3,"intent":3,"constraint_fidelity":3,"usability":3,'
    '"constraints_preserved":true,"violations":[],"summary":"cukup"}\n```',
    'I cannot produce JSON',  # retry too -> degraded fallback
    'I cannot produce JSON either',
    '{"evaluation":{"clarity":5,"intent":5,"constraint_fidelity":5,"usability":5,'
    '"constraints_preserved":true,"violations":[],"summary":"terbaik"}}',
]


@app.post("/v1/chat/completions")
async def completions(request: Request):
    body = await request.json()
    system = body["messages"][0]["content"]
    if "prisma-rubric-v1" in system:
        i = state["eval_calls"] % len(EVALS)
        state["eval_calls"] += 1
        content = EVALS[i]
    else:
        content = json.dumps(GEN, ensure_ascii=False)

    def frames():
        for piece in [content[i:i + 40] for i in range(0, len(content), 40)]:
            yield "data: " + json.dumps({"choices": [{"delta": {"content": piece}}]}) + "\n\n"
        yield "data: [DONE]\n\n"

    if body.get("stream"):
        return StreamingResponse(frames(), media_type="text/event-stream")
    return {"choices": [{"message": {"content": content}}]}
