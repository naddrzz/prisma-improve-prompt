import { GitBranch } from "lucide-react";

export const RsiSummary = ({ report, t, policies }) => !report ? null : (
  <section data-testid="rsi-summary" className="rounded-xl border border-[#84CC16]/30 bg-[#84CC16]/[0.04] p-4 space-y-2">
    <h3 data-testid="rsi-completed" className="text-xs font-semibold text-[#84CC16] flex items-center gap-2"><GitBranch className="h-3.5 w-3.5" />{t.completed}</h3>
    <p data-testid="rsi-run-stats" className="text-xs text-[#F0F6FC]">{report.candidate_count} {t.candidates} · {report.actual_llm_calls}/{report.max_llm_calls} {t.calls}</p>
    <p data-testid="rsi-selected-policy" className="text-xs text-[#8B949E]">{t.applied}: {policies[report.selected_policy]} · {t.worlds}: {report.replay_world_count}</p>
    <p data-testid="rsi-scores" className="text-xs text-[#8B949E]">{t.score}: {report.initial_score.toFixed(2)} → {report.selected_score.toFixed(2)} · {t.selected} {report.selected_candidate.toUpperCase()}</p>
    <p data-testid="rsi-disclaimer" className="text-xs text-[#8B949E] leading-relaxed">{t.disclaimer}</p>
    <details data-testid="rsi-evaluations"><summary data-testid="rsi-evaluations-toggle" className="cursor-pointer text-xs text-[#84CC16]">{t.details}</summary>
      <ul className="mt-2 space-y-2">{report.evaluations.map((e) => (
        <li data-testid={`rsi-evaluation-${e.id}`} key={e.id} className="text-xs text-[#8B949E] leading-relaxed"><span className="font-mono text-[#F0F6FC]">{e.id.toUpperCase()} · {e.score.toFixed(2)}</span> — {e.summary}</li>
      ))}</ul>
    </details>
  </section>
);
