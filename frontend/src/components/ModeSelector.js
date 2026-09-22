import { Wand2, Scissors, Lightbulb } from "lucide-react";

const ICONS = { improve: Wand2, refactor: Scissors, brainstorm: Lightbulb };

export const ModeSelector = ({ t, mode, onChange }) => (
  <div>
    <div
      data-testid="mode-selector"
      className="inline-flex flex-wrap bg-[#0D1117] p-1 rounded-xl border border-[#30363D] gap-1"
    >
      {["improve", "refactor", "brainstorm"].map((m) => {
        const Icon = ICONS[m];
        const active = mode === m;
        return (
          <button
            key={m}
            data-testid={`mode-${m}`}
            onClick={() => onChange(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors duration-150 ${
              active
                ? "bg-[#84CC16] text-[#0D1117] font-semibold shadow-[0_0_15px_rgba(132,204,22,0.3)]"
                : "text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {t.modes[m]}
          </button>
        );
      })}
    </div>
    <p data-testid="mode-hint" className="text-xs text-[#6E7681] mt-3 leading-relaxed">
      {t.modeHints[mode]}
    </p>
  </div>
);
