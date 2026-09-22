import { Eraser, Sparkles, Loader2, Info } from "lucide-react";
import { ModeSelector } from "@/components/ModeSelector";
import { SettingsPanel } from "@/components/SettingsPanel";

export const InputPanel = ({
  t, mode, onModeChange, prompt, setPrompt, context, setContext,
  settings, setSettings, onSubmit, onClear, loading, aiConfigured, limits,
  provider, setProvider,
}) => (
  <div data-testid="input-panel" className="pz-panel p-5 flex flex-col gap-5 h-fit lg:sticky lg:top-24">
    <ModeSelector t={t} mode={mode} onChange={onModeChange} />

    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] font-mono uppercase tracking-wider text-[#6E7681]">{t.originalPrompt}</label>
        <span data-testid="prompt-char-count" className="text-[10px] font-mono text-[#6E7681]">
          {prompt.length} / {limits.max_prompt_chars}
        </span>
      </div>
      <textarea
        data-testid="prompt-input"
        className="pz-field p-4 text-sm leading-relaxed min-h-[220px] resize-y pz-scroll"
        placeholder={t.promptPlaceholder}
        value={prompt}
        maxLength={limits.max_prompt_chars}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit();
        }}
      />
    </div>

    <div className="flex flex-col gap-2">
      <label className="text-[10px] font-mono uppercase tracking-wider text-[#6E7681]">{t.contextLabel}</label>
      <textarea
        data-testid="context-input"
        className="pz-field p-3 text-sm leading-relaxed min-h-[84px] resize-y pz-scroll"
        placeholder={t.contextPlaceholder}
        value={context}
        maxLength={limits.max_context_chars}
        onChange={(e) => setContext(e.target.value)}
      />
    </div>

    <SettingsPanel t={t} settings={settings} onChange={setSettings} provider={provider} onProviderChange={setProvider} />

    <div className="flex items-center gap-3">
      <button
        data-testid="sharpen-prompt-button"
        onClick={onSubmit}
        disabled={loading || !aiConfigured || prompt.trim().length < 3}
        className="flex-1 py-3.5 px-6 bg-[#84CC16] hover:bg-[#A3E635] disabled:bg-[#21262D] disabled:text-[#6E7681] disabled:shadow-none text-[#0D1117] font-bold text-sm rounded-lg transition-colors shadow-[0_0_20px_rgba(132,204,22,0.22)] flex items-center justify-center gap-2 active:scale-[0.99]"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? t.sharpening : t.sharpen}
      </button>
      <button
        data-testid="clear-button"
        onClick={onClear}
        className="px-4 py-3.5 rounded-lg border border-[#30363D] text-[#8B949E] hover:text-[#F87171] hover:border-[#F87171]/50 transition-colors"
        title={t.reset}
      >
        <Eraser className="h-4 w-4" />
      </button>
    </div>
    <p className="text-[10px] font-mono text-[#6E7681] flex items-center gap-1.5">
      <Info className="h-3 w-3" /> ⌘/Ctrl + Enter
    </p>
  </div>
);
