# Prisma — Prompt Intelligence Studio

## Original Problem Statement
Build a fully functional AI-powered web application called "Prisma — Prompt Intelligence Studio" that turns rough ideas, vague instructions, and messy prompts into clear, effective, reusable prompts. Supports prompt improvement, refactoring, and collaborative brainstorming. Indonesian + English interface (default Indonesian). AGI-inspired reasoning framework in server-side system instructions — must never claim to be AGI.

## User Choices
- Model: Claude Sonnet 4.6 via Emergent LLM key (default), plus user-configurable OpenAI-compatible provider
- No authentication / no user accounts
- Session-only in-memory history (no DB persistence of prompts)
- Design: charcoal / white / electric-lime

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), system instructions in `/app/backend/prompts.py`
  - `GET /api/config` — capability + limits report
  - `POST /api/prompt/process` — structured JSON prompt engineering (modes: improve / refactor / brainstorm)
  - `POST /api/provider/test` — connectivity probe for custom OpenAI-compatible endpoints
  - No prompt logging, no prompt persistence, credentials from env only
- Frontend: React + Tailwind + shadcn/ui
  - `src/pages/Studio.js` (state orchestration), `src/components/*` (Header, InputPanel, ResultPanel, SettingsPanel, BrainstormDirections, ClarifyingQuestions, VersionHistory, CompareDialog), `src/lib/i18n.js`, `src/lib/api.js`

## Implemented (2026-06)
- Three modes: Improve (Pertajam), Refactor (Restrukturisasi), Brainstorm (Eksplorasi Ide)
- AGI-inspired reasoning framework + core system instructions server-side; explicit "not AGI" disclaimer in header
- Philosophical lenses (none / socratic / first principles / epistemic humility / pragmatism / systems thinking) with subtle / explicit strength
- Structured output: final prompt, explanation, changes, assumptions, open questions, clarifying questions (max 3, skippable), 3 brainstorm directions with benefits/tradeoffs + recommendation + select/combine
- Settings: output language (Auto / ID / EN), depth, audience, tone, lens, lens strength
- Custom OpenAI-compatible provider: Base URL + Model ID + optional API key + test-connection, session-memory only
- Follow-up refinement chips + custom refinement field; constraints preserved via `current_result`
- Editable result, copy, Markdown download, original-vs-refined compare dialog, session version history with restore
- Empty / loading / error / configuration-required states; input and last result preserved on failure
- Indonesian default UI with instant EN toggle; responsive desktop + mobile

## Verification
- Backend pytest: 11/11 pass (`/app/backend/tests/test_prisma_api.py`)
- Frontend Playwright flows: all reviewed flows pass (see `/app/test_reports/iteration_1.json`)
- Custom provider + Auto language verified manually after iteration 1

## Backlog
- P1: Live streaming of results (SSE) instead of single response
- P1: Prompt library with explicit opt-in persistence
- P2: Shareable read-only links for a refined prompt
- P2: Side-by-side multi-model comparison using the custom provider slots
- P2: Token/cost estimate per run
