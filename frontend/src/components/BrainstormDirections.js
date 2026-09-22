import { Check, Sparkles } from "lucide-react";

export const BrainstormDirections = ({ t, directions, recommendedIndex, selected, onToggle, onUse, onCombine }) => {
  if (!directions?.length) return null;

  return (
    <section data-testid="brainstorm-directions" className="pz-rise">
      <h3 className="text-sm font-semibold text-[#F0F6FC] mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#84CC16]" />
        {t.directions}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {directions.map((d, i) => {
          const isSel = selected.includes(i);
          return (
            <div
              key={i}
              data-testid={`direction-card-${i}`}
              onClick={() => onToggle(i)}
              className={`border rounded-xl p-4 bg-[#0D1117] cursor-pointer transition-colors duration-150 flex flex-col gap-3 ${
                isSel ? "border-[#84CC16] ring-1 ring-[#84CC16] bg-[#84CC16]/[0.04]" : "border-[#30363D] hover:border-[#84CC16]/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-sm font-semibold text-[#F0F6FC] leading-snug">{d.title}</h4>
                {isSel && <Check className="h-4 w-4 text-[#84CC16] shrink-0" />}
              </div>
              {recommendedIndex === i && (
                <span
                  data-testid={`direction-recommended-${i}`}
                  className="self-start bg-[#84CC16]/15 text-[#84CC16] text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border border-[#84CC16]/30"
                >
                  {t.recommended}
                </span>
              )}
              <p className="text-xs text-[#8B949E] leading-relaxed">{d.summary}</p>
              {!!d.benefits?.length && (
                <div>
                  <p className="text-[10px] font-mono uppercase text-[#84CC16] mb-1">{t.benefits}</p>
                  <ul className="text-xs text-[#8B949E] space-y-1 list-disc pl-4">
                    {d.benefits.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                </div>
              )}
              {!!d.tradeoffs?.length && (
                <div>
                  <p className="text-[10px] font-mono uppercase text-[#FBBF24] mb-1">{t.tradeoffs}</p>
                  <ul className="text-xs text-[#8B949E] space-y-1 list-disc pl-4">
                    {d.tradeoffs.map((x, j) => <li key={j}>{x}</li>)}
                  </ul>
                </div>
              )}
              <button
                data-testid={`use-direction-${i}`}
                onClick={(e) => { e.stopPropagation(); onUse(i); }}
                className="mt-auto text-xs font-medium px-3 py-2 rounded-lg border border-[#30363D] text-[#8B949E] hover:text-[#0D1117] hover:bg-[#84CC16] hover:border-[#84CC16] transition-colors"
              >
                {t.useDirection}
              </button>
            </div>
          );
        })}
      </div>
      {selected.length > 1 && (
        <button
          data-testid="combine-directions-button"
          onClick={onCombine}
          className="mt-3 text-xs font-semibold px-4 py-2 rounded-lg bg-[#84CC16] text-[#0D1117] hover:bg-[#A3E635] transition-colors"
        >
          {t.combineSelected} ({selected.length})
        </button>
      )}
    </section>
  );
};
