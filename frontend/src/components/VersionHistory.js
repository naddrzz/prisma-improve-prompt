import { History, RotateCcw } from "lucide-react";

export const VersionHistory = ({ t, versions, activeId, onRestore, loading }) => {
  if (!versions.length) return null;

  return (
    <section data-testid="version-history" className="border border-[#30363D] rounded-xl bg-[#0D1117] p-4">
      <h3 className="text-sm font-semibold text-[#F0F6FC] flex items-center gap-2">
        <History className="h-4 w-4 text-[#84CC16]" />
        {t.history}
      </h3>
      <p className="text-[10px] font-mono text-[#6E7681] mt-1 mb-3">{t.historyHint}</p>
      <ul className="space-y-2 max-h-56 overflow-auto pz-scroll pr-1">
        {versions.map((v, i) => (
          <li
            key={v.id}
            data-testid={`version-item-${i}`}
            className={`flex items-start gap-3 justify-between border rounded-lg px-3 py-2 transition-colors ${
              v.id === activeId ? "border-[#84CC16]/50 bg-[#84CC16]/[0.05]" : "border-[#30363D]"
            }`}
          >
            <div className="min-w-0">
              <p className="text-xs font-mono text-[#84CC16]">
                {t.version} {versions.length - i} · {v.label}
              </p>
              <p className="text-xs text-[#8B949E] truncate mt-0.5">{v.final_prompt.slice(0, 90)}</p>
            </div>
            <button
              data-testid={`restore-version-${i}`}
              disabled={loading}
              onClick={() => onRestore(v)}
              className="shrink-0 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase px-2 py-1 rounded border border-[#30363D] text-[#8B949E] hover:text-[#84CC16] hover:border-[#84CC16]/50 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              {t.restore}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
