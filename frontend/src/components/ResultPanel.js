import { useState } from "react";
import {
  Copy, Check, Download, GitCompare, AlertTriangle, ListChecks,
  HelpCircle, FileText, Loader2, Wand2,
} from "lucide-react";
import { BrainstormDirections } from "@/components/BrainstormDirections";
import { ClarifyingQuestions } from "@/components/ClarifyingQuestions";

const CHIP_KEYS = [
  { key: "shorter", id: "Buat prompt ini lebih ringkas tanpa menghilangkan batasan yang sudah diterima.", en: "Make this prompt shorter without dropping any already-accepted constraint." },
  { key: "technical", id: "Buat prompt ini lebih teknis dan spesifik secara implementasi.", en: "Make this prompt more technical and implementation-specific." },
  { key: "simpler", id: "Sederhanakan bahasanya agar mudah dipahami pembaca non-teknis.", en: "Simplify the language so a non-technical reader can follow it." },
  { key: "edgecases", id: "Tambahkan penanganan edge case dan kondisi kegagalan pada instruksi.", en: "Add edge cases and failure conditions to the instructions." },
  { key: "criteria", id: "Tambahkan kriteria penerimaan yang dapat diverifikasi.", en: "Add verifiable acceptance criteria." },
  { key: "json", id: "Minta output dalam format JSON dengan skema yang jelas.", en: "Request the output as JSON with an explicit schema." },
];

const Block = ({ icon: Icon, title, items, color, testid }) =>
  !items?.length ? null : (
    <div data-testid={testid} className="border border-[#30363D] rounded-xl bg-[#0D1117] p-4">
      <h4 className="text-xs font-semibold flex items-center gap-2 mb-2" style={{ color }}>
        <Icon className="h-3.5 w-3.5" /> {title}
      </h4>
      <ul className="text-xs text-[#8B949E] space-y-1.5 list-disc pl-4 leading-relaxed">
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );

export const ResultPanel = ({
  t, uiLang, result, draft, setDraft, loading, error, onRetry, aiConfigured,
  onRefine, onSample, onCompare, selectedDirections, toggleDirection, onUseDirection,
  onCombineDirections, onAnswerQuestions, onSkipQuestions,
}) => {
  const [copied, setCopied] = useState(false);
  const [custom, setCustom] = useState("");

  const copy = async () => {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const md = `# ${t.finalPrompt}\n\n${draft}\n\n---\n\n## ${t.explanation}\n\n${result?.explanation || "—"}\n${
      result?.assumptions?.length ? `\n## ${t.assumptions}\n\n${result.assumptions.map((a) => `- ${a}`).join("\n")}\n` : ""
    }`;
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "prisma-prompt.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!aiConfigured) {
    return (
      <div data-testid="config-required-state" className="pz-panel p-8 flex flex-col items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-[#FBBF24]" />
        <h3 className="text-lg font-semibold text-[#F0F6FC]">{t.configTitle}</h3>
        <p className="text-sm text-[#8B949E] max-w-lg leading-relaxed">{t.configBody}</p>
      </div>
    );
  }

  return (
    <div data-testid="result-panel" className="pz-panel p-5 flex flex-col gap-4 min-h-[600px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-[#F0F6FC] flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#84CC16]" /> {t.result}
        </h2>
        {result && (
          <div className="flex items-center gap-2">
            <button data-testid="compare-button" onClick={onCompare} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#30363D] text-[#8B949E] hover:text-[#84CC16] hover:border-[#84CC16]/50 transition-colors">
              <GitCompare className="h-3.5 w-3.5" /> {t.compare}
            </button>
            <button data-testid="download-md-button" onClick={download} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#30363D] text-[#8B949E] hover:text-[#84CC16] hover:border-[#84CC16]/50 transition-colors">
              <Download className="h-3.5 w-3.5" /> {t.download}
            </button>
            <button data-testid="copy-button" onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#84CC16] text-[#0D1117] hover:bg-[#A3E635] transition-colors">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t.copied : t.copy}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div data-testid="error-state" className="border border-[#F87171]/40 bg-[#F87171]/[0.06] rounded-xl p-4 pz-rise">
          <h4 className="text-sm font-semibold text-[#F87171] flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {t.errorTitle}
          </h4>
          <p data-testid="error-message" className="text-xs text-[#F0F6FC] mt-1.5">{t.errors[error] || error}</p>
          <p className="text-xs text-[#8B949E] mt-1">{t.errorKeep}</p>
          <button data-testid="retry-button" onClick={onRetry} className="mt-3 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#F87171]/50 text-[#F87171] hover:bg-[#F87171]/10 transition-colors">
            {t.retry}
          </button>
        </div>
      )}

      {loading && (
        <div data-testid="loading-state" className="flex flex-col gap-3 pz-rise">
          <div className="relative h-0.5 w-full bg-[#21262D] overflow-hidden rounded-full pz-sweep" />
          <p className="text-xs font-mono text-[#84CC16] flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t.sharpening}
          </p>
          <div className="space-y-2">
            {[1, 0.75, 0.9, 0.6].map((w, i) => (
              <div key={i} className="h-3 rounded bg-[#21262D]" style={{ width: `${w * 100}%` }} />
            ))}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div data-testid="empty-state" className="flex-1 flex flex-col items-start justify-center gap-3 border border-dashed border-[#30363D] rounded-xl p-8">
          <Wand2 className="h-7 w-7 text-[#30363D]" />
          <h3 className="text-lg font-semibold text-[#F0F6FC]">{t.emptyTitle}</h3>
          <p className="text-sm text-[#8B949E] max-w-md leading-relaxed">{t.emptyBody}</p>
          <button data-testid="try-sample-button" onClick={onSample} className="mt-1 text-xs font-semibold px-4 py-2 rounded-lg border border-[#84CC16]/50 text-[#84CC16] hover:bg-[#84CC16]/10 transition-colors">
            {t.trySample}
          </button>
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-4 pz-rise">
          <ClarifyingQuestions t={t} questions={result.clarifying_questions} onSubmit={onAnswerQuestions} onSkip={onSkipQuestions} />

          <BrainstormDirections
            t={t}
            directions={result.directions}
            recommendedIndex={result.recommended_index}
            selected={selectedDirections}
            onToggle={toggleDirection}
            onUse={onUseDirection}
            onCombine={onCombineDirections}
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#84CC16]">{t.finalPrompt}</label>
              {draft !== result.final_prompt && (
                <span data-testid="edited-badge" className="text-[10px] font-mono uppercase text-[#FBBF24]">{t.editedBadge}</span>
              )}
            </div>
            <textarea
              data-testid="final-prompt-output"
              className="pz-field p-4 text-sm font-mono leading-relaxed min-h-[280px] resize-y pz-scroll"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>

          {result.explanation && (
            <div data-testid="explanation-block" className="border border-[#30363D] rounded-xl bg-[#0D1117] p-4">
              <h4 className="text-xs font-semibold text-[#84CC16] flex items-center gap-2 mb-2">
                <ListChecks className="h-3.5 w-3.5" /> {t.explanation}
              </h4>
              <p className="text-xs text-[#8B949E] leading-relaxed">{result.explanation}</p>
            </div>
          )}

          <Block testid="changes-block" icon={ListChecks} title={t.changes} items={result.changes} color="#38BDF8" />
          <Block testid="assumptions-block" icon={HelpCircle} title={t.assumptions} items={result.assumptions} color="#C084FC" />
          <Block testid="open-questions-block" icon={AlertTriangle} title={t.openQuestions} items={result.open_questions} color="#FBBF24" />

          <div data-testid="followups" className="border-t border-[#30363D] pt-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#6E7681] mb-2.5">{t.followUps}</p>
            <div className="flex flex-wrap gap-2">
              {CHIP_KEYS.map((c) => (
                <button
                  key={c.key}
                  data-testid={`refine-chip-${c.key}`}
                  disabled={loading}
                  onClick={() => onRefine(c[uiLang] || c.en)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-[#30363D] bg-[#0D1117] text-[#8B949E] hover:text-[#84CC16] hover:border-[#84CC16]/50 disabled:opacity-40 transition-colors"
                >
                  {t.chips[c.key]}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <input
                data-testid="custom-refine-input"
                className="pz-field px-3 py-2 text-sm flex-1"
                placeholder={t.customRefine}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { onRefine(custom.trim()); setCustom(""); } }}
              />
              <button
                data-testid="apply-refine-button"
                disabled={!custom.trim() || loading}
                onClick={() => { onRefine(custom.trim()); setCustom(""); }}
                className="px-4 py-2 rounded-lg bg-[#21262D] border border-[#30363D] text-xs font-semibold text-[#F0F6FC] hover:border-[#84CC16] hover:text-[#84CC16] disabled:opacity-40 transition-colors"
              >
                {t.apply}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
