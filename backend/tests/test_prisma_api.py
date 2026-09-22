"""Backend tests for Prisma — Prompt Intelligence Studio."""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://clarity-lens-16.preview.emergentagent.com").rstrip("/")
TIMEOUT = 180


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _post(s, payload):
    return s.post(f"{BASE_URL}/api/prompt/process", json=payload, timeout=TIMEOUT)


# ---- Config ----
class TestConfig:
    def test_config(self, s):
        r = s.get(f"{BASE_URL}/api/config", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["ai_configured"] is True
        assert d["provider"] == "anthropic"
        assert d["model"] == "claude-sonnet-4-6"
        assert d["max_prompt_chars"] == 12000
        assert d["max_context_chars"] == 6000


# ---- Validation ----
class TestValidation:
    def test_too_short(self, s):
        r = _post(s, {"mode": "improve", "prompt": "hi"})
        assert r.status_code == 422
        assert r.json()["detail"] == "PROMPT_TOO_SHORT"

    def test_too_long(self, s):
        r = _post(s, {"mode": "improve", "prompt": "a" * 12001})
        assert r.status_code == 422
        assert r.json()["detail"] == "PROMPT_TOO_LONG"

    def test_context_too_long(self, s):
        r = _post(s, {"mode": "improve", "prompt": "valid prompt for test",
                      "context": "c" * 6001})
        assert r.status_code == 422
        assert r.json()["detail"] == "CONTEXT_TOO_LONG"


# Detect Indonesian words vs English
INDONESIAN_HINTS = re.compile(r"\b(dan|yang|untuk|dengan|adalah|dari|pada|atau|ini|itu|saya|buat|dalam)\b", re.I)
ENGLISH_HINTS = re.compile(r"\b(the|and|for|with|is|are|from|this|that|of|to|in|make|write)\b", re.I)


# ---- Modes & language ----
class TestImprove:
    def test_improve_id(self, s):
        r = _post(s, {
            "mode": "improve",
            "prompt": "Tolong buatkan artikel tentang AI untuk blog perusahaan, buat menarik.",
            "settings": {"output_language": "id"},
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["final_prompt"].strip()
        assert d["explanation"].strip()
        # Should be Indonesian - many Indonesian hints
        assert len(INDONESIAN_HINTS.findall(d["final_prompt"])) >= 3, d["final_prompt"][:400]

    def test_improve_en(self, s):
        r = _post(s, {
            "mode": "improve",
            "prompt": "Write a blog post about renewable energy for beginners.",
            "settings": {"output_language": "en"},
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["final_prompt"].strip()
        assert len(ENGLISH_HINTS.findall(d["final_prompt"])) >= 5
        # It should not be predominantly Indonesian
        id_hits = len(INDONESIAN_HINTS.findall(d["final_prompt"]))
        en_hits = len(ENGLISH_HINTS.findall(d["final_prompt"]))
        assert en_hits > id_hits

    def test_two_inputs_differ(self, s):
        r1 = _post(s, {"mode": "improve",
                       "prompt": "Buatkan resep masakan padang untuk pemula memasak di rumah.",
                       "settings": {"output_language": "id"}})
        r2 = _post(s, {"mode": "improve",
                       "prompt": "Desain arsitektur microservice untuk aplikasi fintech skala besar.",
                       "settings": {"output_language": "id"}})
        assert r1.status_code == 200 and r2.status_code == 200
        f1 = r1.json()["final_prompt"].lower()
        f2 = r2.json()["final_prompt"].lower()
        # Domain-specific words must appear in each
        assert ("resep" in f1 or "masak" in f1 or "padang" in f1)
        assert ("microservice" in f2 or "fintech" in f2 or "arsitektur" in f2)


class TestRefactor:
    def test_refactor_preserves_constraints(self, s):
        prompt = (
            "Tuliskan panduan teknis migrasi database. Sistem harus menggunakan PostgreSQL 16. "
            "Jangan gunakan format bullet list. Tenggat: hari Jumat."
        )
        r = _post(s, {"mode": "refactor", "prompt": prompt,
                      "settings": {"output_language": "id"}})
        assert r.status_code == 200, r.text
        d = r.json()
        fp = d["final_prompt"]
        assert "PostgreSQL 16" in fp
        assert "Jumat" in fp or "friday" in fp.lower()
        # Must mention prohibition of bullet lists
        assert re.search(r"bullet", fp, re.I) or "daftar" in fp.lower() or "list" in fp.lower()
        assert isinstance(d["changes"], list) and len(d["changes"]) >= 1


class TestBrainstorm:
    def test_brainstorm_three_directions(self, s):
        r = _post(s, {
            "mode": "brainstorm",
            "prompt": "Ide untuk aplikasi produktivitas untuk mahasiswa.",
            "settings": {"output_language": "id"},
        })
        assert r.status_code == 200, r.text
        d = r.json()
        dirs = d["directions"]
        assert len(dirs) == 3
        for dr in dirs:
            assert dr["title"] and dr["summary"]
            assert isinstance(dr["benefits"], list) and len(dr["benefits"]) >= 1
            assert isinstance(dr["tradeoffs"], list) and len(dr["tradeoffs"]) >= 1
        assert isinstance(d["recommended_index"], int) and 0 <= d["recommended_index"] <= 2
        assert d["final_prompt"].strip()
        # Directions must differ
        titles = {dr["title"].lower() for dr in dirs}
        assert len(titles) == 3


class TestLens:
    def test_lens_changes_output(self, s):
        base = {"mode": "improve", "prompt": "Buat rencana peluncuran produk SaaS baru untuk startup.",
                "settings": {"output_language": "id"}}
        r_none = _post(s, {**base, "settings": {**base["settings"], "lens": "none"}})
        r_socr = _post(s, {**base, "settings": {**base["settings"], "lens": "socratic", "lens_strength": "explicit"}})
        r_sys = _post(s, {**base, "settings": {**base["settings"], "lens": "systems_thinking", "lens_strength": "explicit"}})
        for r in (r_none, r_socr, r_sys):
            assert r.status_code == 200, r.text
        f_none = r_none.json()["final_prompt"]
        f_socr = r_socr.json()["final_prompt"]
        f_sys = r_sys.json()["final_prompt"]
        assert f_none != f_socr != f_sys
        # Socratic explicit should reference assumptions/questioning
        assert re.search(r"asumsi|pertany|klarif|sokrat", f_socr, re.I), f_socr[:400]
        # Systems thinking should reference dependencies/feedback/downstream
        assert re.search(r"depend|umpan\s*balik|sistem|downstream|siklus|efek|keterkaitan", f_sys, re.I), f_sys[:400]


class TestFollowUp:
    def test_follow_up_preserves_constraint(self, s):
        current = (
            "# Tugas\nTulis artikel 800 kata tentang perubahan iklim.\n\n"
            "## Batasan\n- Harus menyebutkan data IPCC 2023.\n- Nada akademis.\n"
        )
        r = _post(s, {
            "mode": "improve",
            "prompt": "Artikel tentang perubahan iklim.",
            "current_result": current,
            "instruction": "Buat prompt ini lebih ringkas.",
            "settings": {"output_language": "id"},
        })
        assert r.status_code == 200, r.text
        fp = r.json()["final_prompt"]
        assert "IPCC" in fp, fp[:400]
