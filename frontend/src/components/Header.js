import { Languages, Triangle } from "lucide-react";

export const Header = ({ t, uiLang, onToggleLang, model, aiConfigured }) => (
  <header
    data-testid="app-header"
    className="sticky top-0 z-50 h-16 border-b border-[#30363D] bg-[#0D1117]/85 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between"
  >
    <div className="flex items-center gap-3 min-w-0">
      <div className="h-9 w-9 rounded-lg bg-[#84CC16] flex items-center justify-center shrink-0 shadow-[0_0_18px_rgba(132,204,22,0.3)]">
        <Triangle className="h-4 w-4 text-[#0D1117]" strokeWidth={3} />
      </div>
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-tight leading-none text-[#F0F6FC]">
          {t.appName}
          <span className="hidden sm:inline text-[#6E7681] font-normal"> — {t.tagline}</span>
        </h1>
        <p data-testid="agi-disclaimer" className="text-[10px] font-mono text-[#6E7681] mt-1 truncate">
          {t.disclaimer}
        </p>
      </div>
    </div>

    <div className="flex items-center gap-3 shrink-0">
      <span
        data-testid="model-badge"
        className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-md border border-[#30363D] text-[#8B949E]"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${aiConfigured ? "bg-[#84CC16]" : "bg-[#F87171]"}`} />
        {model || "—"}
      </span>
      <button
        data-testid="language-toggle"
        onClick={onToggleLang}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#30363D] text-xs font-mono uppercase text-[#8B949E] hover:text-[#84CC16] hover:border-[#84CC16]/50 transition-colors"
      >
        <Languages className="h-3.5 w-3.5" />
        {uiLang.toUpperCase()}
      </button>
    </div>
  </header>
);
