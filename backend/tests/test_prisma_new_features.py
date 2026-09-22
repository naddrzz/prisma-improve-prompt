"""Iteration-2 tests: auto output language + custom OpenAI-compatible provider."""
import os
import re
import subprocess
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
TIMEOUT = 180


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _proc(s, payload):
    return s.post(f"{BASE_URL}/api/prompt/process", json=payload, timeout=TIMEOUT)


def _test_provider(s, payload):
    return s.post(f"{BASE_URL}/api/provider/test", json=payload, timeout=30)


ID_HINTS = re.compile(r"\b(dan|yang|untuk|dengan|adalah|dari|pada|atau|ini|itu|saya|buat|dalam|sebuah|akan)\b", re.I)
EN_HINTS = re.compile(r"\b(the|and|for|with|is|are|from|this|that|of|to|in|make|write|should|will)\b", re.I)


# ---- /api/config ----
class TestConfigCustomProviderFlag:
    def test_supports_custom_provider_true(self, s):
        r = s.get(f"{BASE_URL}/api/config", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("supports_custom_provider") is True
        # existing fields still present
        assert d["ai_configured"] is True
        assert d["provider"] == "anthropic"
        assert d["model"] == "claude-sonnet-4-6"


# ---- Auto language ----
class TestAutoLanguage:
    def test_auto_english_input_produces_english(self, s):
        r = _proc(s, {
            "mode": "improve",
            "prompt": "Write a comprehensive guide about how to onboard new engineers at a startup.",
            "settings": {"output_language": "auto"},
        })
        assert r.status_code == 200, r.text
        d = r.json()
        fp = d["final_prompt"]
        expl = d["explanation"]
        assert fp.strip()
        en_hits = len(EN_HINTS.findall(fp))
        id_hits = len(ID_HINTS.findall(fp))
        assert en_hits > id_hits, f"expected English dominant; en={en_hits} id={id_hits}\n{fp[:400]}"
        # explanation should also be English
        assert len(EN_HINTS.findall(expl)) >= len(ID_HINTS.findall(expl)), expl[:300]
        # response model should be default
        assert d["model"] == "claude-sonnet-4-6"

    def test_auto_indonesian_input_produces_indonesian(self, s):
        r = _proc(s, {
            "mode": "improve",
            "prompt": "Buatkan panduan lengkap untuk melakukan onboarding karyawan baru di sebuah startup teknologi.",
            "settings": {"output_language": "auto"},
        })
        assert r.status_code == 200, r.text
        d = r.json()
        fp = d["final_prompt"]
        id_hits = len(ID_HINTS.findall(fp))
        en_hits = len(EN_HINTS.findall(fp))
        assert id_hits > en_hits, f"expected Indonesian dominant; id={id_hits} en={en_hits}\n{fp[:400]}"

    def test_explicit_en_overrides(self, s):
        # Indonesian prompt but forced English output
        r = _proc(s, {
            "mode": "improve",
            "prompt": "Buatkan panduan onboarding karyawan baru di startup.",
            "settings": {"output_language": "en"},
        })
        assert r.status_code == 200, r.text
        fp = r.json()["final_prompt"]
        assert len(EN_HINTS.findall(fp)) > len(ID_HINTS.findall(fp)), fp[:400]

    def test_explicit_id_overrides(self, s):
        r = _proc(s, {
            "mode": "improve",
            "prompt": "Write a plan to launch a new SaaS product for small businesses.",
            "settings": {"output_language": "id"},
        })
        assert r.status_code == 200, r.text
        fp = r.json()["final_prompt"]
        assert len(ID_HINTS.findall(fp)) > len(EN_HINTS.findall(fp)), fp[:400]


# ---- Provider test endpoint ----
class TestProviderEndpoint:
    def test_invalid_base_url(self, s):
        r = _test_provider(s, {"base_url": "notaurl", "model": "gpt-4o-mini", "api_key": "sk-x"})
        assert r.status_code in (422, 502)
        assert r.json()["detail"] == "INVALID_BASE_URL"

    def test_incomplete_missing_model(self, s):
        r = _test_provider(s, {"base_url": "https://api.openai.com/v1", "model": "", "api_key": "sk-x"})
        assert r.status_code == 422
        assert r.json()["detail"] == "PROVIDER_INCOMPLETE"

    def test_incomplete_missing_base_url(self, s):
        r = _test_provider(s, {"base_url": "", "model": "gpt-4o-mini", "api_key": "sk-x"})
        assert r.status_code == 422
        assert r.json()["detail"] == "PROVIDER_INCOMPLETE"

    def test_unauthorized(self, s):
        # Hit backend directly: Cloudflare/ingress replaces any 502 with an HTML error page,
        # so this can't be tested via the public URL. Documented as a critical UX issue.
        r = requests.post(
            "http://localhost:8001/api/provider/test",
            json={
                "base_url": "https://api.openai.com/v1",
                "model": "gpt-4o-mini",
                "api_key": "sk-invalid",
            },
            timeout=30,
        )
        assert r.status_code == 502, r.text
        assert r.json()["detail"] == "PROVIDER_UNAUTHORIZED"

    def test_unauthorized_via_public_url_gets_cloudflare_html(self, s):
        """Regression: 502 responses are replaced by Cloudflare HTML at the edge,
        so the frontend never sees PROVIDER_UNAUTHORIZED. This test documents the issue."""
        r = _test_provider(s, {
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "sk-invalid",
        })
        assert r.status_code == 502
        # Cloudflare HTML, not JSON
        assert "<!DOCTYPE html>" in r.text or r.text.startswith("<"), \
            "Body is JSON — 502 pass-through is fine after all"


# ---- Provider in process endpoint ----
class TestProcessWithProvider:
    def test_invalid_base_url_no_fallback(self, s):
        r = _proc(s, {
            "mode": "improve",
            "prompt": "Write a blog post about renewable energy.",
            "settings": {"output_language": "en"},
            "provider": {"base_url": "notaurl", "model": "gpt-4o-mini", "api_key": "sk-x"},
        })
        # must NOT silently succeed with default model
        assert r.status_code != 200, r.text
        assert r.json()["detail"] == "INVALID_BASE_URL"

    def test_provider_null_uses_default(self, s):
        r = _proc(s, {
            "mode": "improve",
            "prompt": "Write a short article about time management for students.",
            "settings": {"output_language": "en"},
            "provider": None,
        })
        assert r.status_code == 200, r.text
        assert r.json()["model"] == "claude-sonnet-4-6"

    def test_provider_omitted_uses_default(self, s):
        r = _proc(s, {
            "mode": "improve",
            "prompt": "Write a short article about time management for students.",
            "settings": {"output_language": "en"},
        })
        assert r.status_code == 200, r.text
        assert r.json()["model"] == "claude-sonnet-4-6"


# ---- Logs should never contain the api key ----
class TestNoApiKeyLeak:
    def test_no_sk_in_backend_logs(self):
        # Only checking after the above tests ran with 'sk-invalid'
        out = subprocess.run(
            ["bash", "-lc", "grep -R 'sk-invalid' /var/log/supervisor/backend.*.log || true"],
            capture_output=True, text=True, timeout=15,
        )
        assert "sk-invalid" not in out.stdout, f"API key leaked in logs:\n{out.stdout[:500]}"
