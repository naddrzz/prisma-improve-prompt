import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { InputPanel } from "@/components/InputPanel";
import { ResultPanel } from "@/components/ResultPanel";
import { VersionHistory } from "@/components/VersionHistory";
import { CompareDialog } from "@/components/CompareDialog";
import { useT } from "@/lib/i18n";
import { fetchConfig, streamPrompt } from "@/lib/api";

const DEFAULT_LIMITS = { max_prompt_chars: 12000, max_context_chars: 6000 };

export default function Studio() {
  const [uiLang, setUiLang] = useState("id");
  const t = useT(uiLang);

  const [mode, setMode] = useState("improve");
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [settings, setSettings] = useState({
    output_language: "auto",
    depth: "balanced",
    audience: "",
    tone: "neutral",
    lens: "none",
    lens_strength: "subtle",
  });
  const [provider, setProvider] = useState({ enabled: false, base_url: "", model: "", api_key: "" });

  const [result, setResult] = useState(null);
  const [draft, setDraft] = useState("");
  const [versions, setVersions] = useState([]);
  const [activeVersionId, setActiveVersionId] = useState(null);
  const [selectedDirections, setSelectedDirections] = useState([]);
  const [baselinePrompt, setBaselinePrompt] = useState("");

  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState(null);
  const [lastPayload, setLastPayload] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [config, setConfig] = useState({ ai_configured: true, model: "", ...DEFAULT_LIMITS });

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig((c) => ({ ...c, ai_configured: false })));
  }, []);

  const toggleLang = () => {
    const next = uiLang === "id" ? "en" : "id";
    setUiLang(next);
    setSettings((s) => (s.output_language === "auto" ? s : { ...s, output_language: next }));
  };

  const customActive = provider.enabled && !!provider.base_url.trim() && !!provider.model.trim();
  const canRun = config.ai_configured || customActive;
  const activeModel = customActive ? provider.model.trim() : config.model;

  const run = useCallback(
    async (payload, label) => {
      setLoading(true);
      setError(null);
      setStreamText("");
      setLastPayload({ payload, label });
      let streamed = "";
      try {
        let data = null;
        await streamPrompt(payload, {
          onDelta: (text) => {
            streamed += text;
            setStreamText(streamed);
          },
          onResult: (d) => {
            data = d;
          },
        });
        if (!data) throw new Error("AI_BAD_RESPONSE");
        setResult(data);
        setDraft(data.final_prompt);
        setSelectedDirections(
          typeof data.recommended_index === "number" ? [data.recommended_index] : []
        );
        const version = { id: crypto.randomUUID(), label, final_prompt: data.final_prompt, data };
        setVersions((v) => [version, ...v].slice(0, 20));
        setActiveVersionId(version.id);
        toast.success(uiLang === "id" ? "Prompt diperbarui" : "Prompt updated");
      } catch (e) {
        setError(e.message);
        toast.error(t.errors[e.message] || t.errorTitle);
      } finally {
        setStreamText("");
        setLoading(false);
      }
    },
    [uiLang, t]
  );

  const providerPayload = () =>
    customActive
      ? { base_url: provider.base_url.trim(), model: provider.model.trim(), api_key: provider.api_key }
      : null;

  const submit = () => {
    if (prompt.trim().length < 3) return;
    setBaselinePrompt(prompt.trim());
    run(
      { mode, prompt: prompt.trim(), context, settings, provider: providerPayload() },
      t.modes[mode]
    );
  };

  const refine = (instruction) =>
    run(
      { mode, prompt: prompt.trim(), context, settings, instruction, current_result: draft, provider: providerPayload() },
      instruction.length > 34 ? `${instruction.slice(0, 34)}…` : instruction
    );

  const retry = () => lastPayload && run(lastPayload.payload, lastPayload.label);

  const clearAll = () => {
    setPrompt("");
    setContext("");
    setResult(null);
    setDraft("");
    setVersions([]);
    setError(null);
    setSelectedDirections([]);
    setBaselinePrompt("");
  };

  const toggleDirection = (i) =>
    setSelectedDirections((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));

  const useDirection = (i) => {
    const d = result?.directions?.[i];
    if (!d) return;
    setSelectedDirections([i]);
    refine(
      uiLang === "id"
        ? `Gunakan arah "${d.title}" dan ubah menjadi prompt final yang lengkap dan siap pakai.`
        : `Use the "${d.title}" direction and turn it into a complete, ready-to-use final prompt.`
    );
  };

  const combineDirections = () => {
    const titles = selectedDirections
      .map((i) => result?.directions?.[i]?.title)
      .filter(Boolean);
    if (titles.length < 2) return;
    refine(
      uiLang === "id"
        ? `Gabungkan arah berikut menjadi satu prompt final yang koheren: ${titles.join(", ")}.`
        : `Combine these directions into one coherent final prompt: ${titles.join(", ")}.`
    );
  };

  const answerQuestions = (pairs) => {
    if (!pairs.length) return refine(uiLang === "id" ? "Lanjutkan dengan asumsi yang jelas dan berlabel." : "Proceed with clearly labeled assumptions.");
    const body = pairs.map((p) => `Q: ${p.q}\nA: ${p.a}`).join("\n");
    refine(
      (uiLang === "id" ? "Jawaban atas pertanyaan klarifikasi:\n" : "Answers to your clarifying questions:\n") + body
    );
  };

  const skipQuestions = () =>
    refine(
      uiLang === "id"
        ? "Lewati pertanyaan klarifikasi. Lanjutkan dan tandai setiap asumsi secara eksplisit."
        : "Skip the clarifying questions. Proceed and label every assumption explicitly."
    );

  const restore = (v) => {
    setResult(v.data);
    setDraft(v.final_prompt);
    setActiveVersionId(v.id);
    toast.success(uiLang === "id" ? "Versi dipulihkan" : "Version restored");
  };

  const limits = useMemo(
    () => ({
      max_prompt_chars: config.max_prompt_chars || DEFAULT_LIMITS.max_prompt_chars,
      max_context_chars: config.max_context_chars || DEFAULT_LIMITS.max_context_chars,
    }),
    [config]
  );

  return (
    <div className="min-h-screen bg-[#0D1117]">
      <Header
        t={t}
        uiLang={uiLang}
        onToggleLang={toggleLang}
        model={activeModel}
        aiConfigured={canRun}
      />

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-8 max-w-[1600px] mx-auto">
        <div className="lg:col-span-5 flex flex-col gap-6">
          <InputPanel
            t={t}
            mode={mode}
            onModeChange={setMode}
            prompt={prompt}
            setPrompt={setPrompt}
            context={context}
            setContext={setContext}
            settings={settings}
            setSettings={setSettings}
            onSubmit={submit}
            onClear={clearAll}
            loading={loading}
            aiConfigured={canRun}
            limits={limits}
            provider={provider}
            setProvider={setProvider}
          />
          <VersionHistory t={t} versions={versions} activeId={activeVersionId} onRestore={restore} />
        </div>

        <div className="lg:col-span-7">
          <ResultPanel
            t={t}
            uiLang={uiLang}
            result={result}
            draft={draft}
            setDraft={setDraft}
            loading={loading}
            streamText={streamText}
            error={error}
            onRetry={retry}
            aiConfigured={canRun}
            onRefine={refine}
            onSample={() => setPrompt(t.sample)}
            onCompare={() => setCompareOpen(true)}
            selectedDirections={selectedDirections}
            toggleDirection={toggleDirection}
            onUseDirection={useDirection}
            onCombineDirections={combineDirections}
            onAnswerQuestions={answerQuestions}
            onSkipQuestions={skipQuestions}
          />
        </div>
      </main>

      <CompareDialog
        t={t}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        original={baselinePrompt || prompt}
        refined={draft}
      />
    </div>
  );
}
