"""Tests for streaming endpoint and custom provider."""
import json
import os
import re
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
STREAM_URL = f"{BASE_URL}/api/prompt/stream"
PROVIDER_URL = f"{BASE_URL}/api/provider/test"
PROCESS_URL = f"{BASE_URL}/api/prompt/process"
TIMEOUT = 180


def _consume_stream(payload):
    """Send POST and return (status_code, frames_list, raw_text)."""
    with requests.post(STREAM_URL, json=payload, stream=True, timeout=TIMEOUT) as r:
        if r.status_code != 200:
            return r.status_code, [], r.text
        frames = []
        buf = ""
        for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
            if not chunk:
                continue
            buf += chunk
            while "\n\n" in buf:
                frame, buf = buf.split("\n\n", 1)
                for line in frame.splitlines():
                    if line.startswith("data: "):
                        try:
                            frames.append(json.loads(line[6:]))
                        except json.JSONDecodeError:
                            pass
        return 200, frames, ""


# --- Validation on stream endpoint ---
class TestStreamValidation:
    def test_prompt_too_short(self):
        r = requests.post(STREAM_URL, json={"mode": "improve", "prompt": "hi"}, timeout=30)
        assert r.status_code == 422
        assert r.json()["detail"] == "PROMPT_TOO_SHORT"

    def test_context_too_long(self):
        r = requests.post(
            STREAM_URL,
            json={"mode": "improve", "prompt": "valid prompt for test", "context": "c" * 6001},
            timeout=30,
        )
        assert r.status_code == 422
        assert r.json()["detail"] == "CONTEXT_TOO_LONG"


# --- Streaming happy path ---
class TestStreamImprove:
    def test_improve_streams_deltas_and_result(self):
        code, frames, _ = _consume_stream({
            "mode": "improve",
            "prompt": "Write a blog post about renewable energy for beginners.",
            "settings": {"output_language": "en"},
        })
        assert code == 200
        deltas = [f for f in frames if f.get("type") == "delta"]
        results = [f for f in frames if f.get("type") == "result"]
        errors = [f for f in frames if f.get("type") == "error"]
        assert not errors, f"unexpected errors: {errors}"
        assert len(deltas) >= 2, f"expected multiple deltas, got {len(deltas)}"
        assert len(results) == 1, f"expected exactly one result frame, got {len(results)}"

        # Check content-type header
        streamed = "".join(d["text"] for d in deltas)
        result_data = results[0]["data"]
        final = result_data["final_prompt"]
        assert final.strip()
        assert result_data.get("explanation") is not None
        assert "changes" in result_data
        # Streamed text should be prefix of final (or equal, allowing trimming)
        assert final.startswith(streamed) or streamed.startswith(final) or streamed == final, (
            f"stream/final mismatch: streamed_len={len(streamed)} final_len={len(final)}"
        )


class TestStreamBrainstorm:
    def test_brainstorm_streams_and_returns_3_directions(self):
        code, frames, _ = _consume_stream({
            "mode": "brainstorm",
            "prompt": "Ide untuk aplikasi produktivitas untuk mahasiswa.",
            "settings": {"output_language": "id"},
        })
        assert code == 200
        deltas = [f for f in frames if f.get("type") == "delta"]
        results = [f for f in frames if f.get("type") == "result"]
        assert len(deltas) >= 1
        assert len(results) == 1
        d = results[0]["data"]
        assert len(d["directions"]) == 3
        assert isinstance(d["recommended_index"], int)
        assert 0 <= d["recommended_index"] <= 2


# --- Custom provider on stream ---
class TestStreamCustomProvider:
    def test_invalid_base_url_returns_422(self):
        r = requests.post(STREAM_URL, json={
            "mode": "improve",
            "prompt": "valid prompt for test",
            "provider": {"base_url": "notaurl", "model": "x", "api_key": ""},
        }, timeout=30)
        assert r.status_code == 422
        assert r.json()["detail"] == "INVALID_BASE_URL"

    def test_bogus_openai_key_surfaces_error(self):
        # Should either return HTTP error or an SSE error frame with PROVIDER_UNAUTHORIZED
        code, frames, raw = _consume_stream({
            "mode": "improve",
            "prompt": "valid prompt for test",
            "provider": {
                "base_url": "https://api.openai.com/v1",
                "model": "gpt-4o-mini",
                "api_key": "sk-invalid",
            },
        })
        if code != 200:
            assert code in (401, 403, 422, 502)
        else:
            errors = [f for f in frames if f.get("type") == "error"]
            assert errors, f"expected error frame, got frames: {frames[:3]}"
            assert errors[0]["code"] in ("PROVIDER_UNAUTHORIZED", "PROVIDER_REQUEST_FAILED")


# --- Provider test endpoint ---
class TestProviderTest:
    def test_invalid_base_url(self):
        r = requests.post(PROVIDER_URL, json={
            "base_url": "notaurl", "model": "x", "api_key": ""
        }, timeout=30)
        assert r.status_code == 422
        assert r.json()["detail"] == "INVALID_BASE_URL"

    def test_openai_unauthorized(self):
        r = requests.post(PROVIDER_URL, json={
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "sk-invalid",
        }, timeout=60)
        assert r.status_code == 502
        assert r.json()["detail"] == "PROVIDER_UNAUTHORIZED"

    def test_incomplete(self):
        r = requests.post(PROVIDER_URL, json={"base_url": "", "model": "", "api_key": ""}, timeout=30)
        assert r.status_code == 422
        assert r.json()["detail"] == "PROVIDER_INCOMPLETE"


# --- Regression: non-streaming still works with output_language auto/id/en ---
INDONESIAN_HINTS = re.compile(r"\b(dan|yang|untuk|dengan|adalah|dari|pada|atau|ini|itu|saya|buat|dalam)\b", re.I)
ENGLISH_HINTS = re.compile(r"\b(the|and|for|with|is|are|from|this|that|of|to|in|make|write)\b", re.I)


class TestProcessRegression:
    def test_auto_detects_indonesian(self):
        r = requests.post(PROCESS_URL, json={
            "mode": "improve",
            "prompt": "Tolong buatkan artikel tentang AI untuk blog perusahaan yang menarik.",
            "settings": {"output_language": "auto"},
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        fp = r.json()["final_prompt"]
        assert len(INDONESIAN_HINTS.findall(fp)) >= 3, fp[:400]

    def test_auto_detects_english(self):
        r = requests.post(PROCESS_URL, json={
            "mode": "improve",
            "prompt": "Write a blog post about renewable energy for beginners.",
            "settings": {"output_language": "auto"},
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        fp = r.json()["final_prompt"]
        assert len(ENGLISH_HINTS.findall(fp)) >= 5, fp[:400]

    def test_explicit_id(self):
        r = requests.post(PROCESS_URL, json={
            "mode": "improve",
            "prompt": "Write a blog post about renewable energy for beginners.",
            "settings": {"output_language": "id"},
        }, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        fp = r.json()["final_prompt"]
        assert len(INDONESIAN_HINTS.findall(fp)) >= 3, fp[:400]
