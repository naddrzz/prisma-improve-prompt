import { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { evaluateReplay } from "@/lib/api";
import { buildWorld } from "@/lib/replay";

const ReplayResults = ({ report, t }) => (
  <div data-testid="replay-report" className="space-y-3 mt-4">
    <p data-testid="replay-winner" className="text-xs text-[#84CC16]">
      {t.selected}: {t.policies[report.selected_policy]} · {t.gain}: {report.replay_gain.toFixed(3)}
    </p>
    <div className="overflow-x-auto">
      <table data-testid="replay-score-table" className="w-full text-xs text-left">
        <thead className="text-[#8B949E]"><tr><th className="py-2">{t.strategy}</th><th>V</th><th>{t.probes}</th><th>{t.rounds}</th></tr></thead>
        <tbody>{report.results.map((r) => (
          <tr key={r.policy} data-testid={`replay-policy-${r.policy}`} className="border-t border-[#30363D]">
            <td className="py-2 pr-2">{t.policies[r.policy]}</td>
            <td>{r.mean_score.toFixed(3)}</td><td>{r.worlds[0].represented_calls}</td><td>{r.worlds[0].rounds}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
    <details data-testid="replay-trajectory"><summary data-testid="replay-trajectory-toggle" className="cursor-pointer text-xs text-[#8B949E]">{t.trajectory}</summary>
      <ol className="mt-2 space-y-1 text-xs text-[#8B949E]">{report.results.find((r) => r.policy === report.selected_policy).worlds[0].trajectory.map((step) => (
        <li data-testid={`replay-round-${step.round}`} key={step.round}>{t.rounds} {step.round}: {step.revealed.length} {t.probes.toLowerCase()} · {t.best} {step.best_score.toFixed(2)}</li>
      ))}</ol>
    </details>
    <p data-testid="replay-no-calls" className="text-xs text-[#8B949E]">{t.noCalls}</p>
  </div>
);

export const ReplayLab = ({ versions, activeId, sessionId, t, loading, draft, onRate }) => {
  const [worldId, setWorldId] = useState("");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const worlds = useMemo(() => [...new Set(versions.map((v) => v.world_id))], [versions]);
  const active = versions.find((v) => v.id === activeId);
  const trace = useMemo(() => buildWorld(versions, worldId), [versions, worldId]);
  useEffect(() => { setWorldId(active?.world_id || ""); }, [active?.world_id]);
  useEffect(() => { generation.current += 1; setReport(null); setError(""); setBusy(false); }, [versions, worldId]);
  const evaluate = async () => {
    const run = ++generation.current;
    setBusy(true); setError(""); setReport(null);
    try {
      const data = await evaluateReplay({ session_id: sessionId, worlds: [trace.world], workers: 1, max_rounds: 20, beta1: 0.02, beta2: 0 });
      if (generation.current === run) setReport(data);
    } catch (e) { if (generation.current === run) setError(t.failed); }
    finally { if (generation.current === run) setBusy(false); }
  };
  return (
    <section data-testid="replay-lab" className="border border-[#30363D] rounded-xl bg-[#161B22] p-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-[#F0F6FC]"><FlaskConical className="w-4 h-4 text-[#84CC16]" />{t.title}</h3>
      <p data-testid="replay-scope" className="text-xs text-[#8B949E] leading-relaxed">{t.scope}</p>
      <a data-testid="replay-paper-link" href="/dream-rsi-prisma.md" download className="text-xs text-[#84CC16] hover:underline inline-block">{t.analysis}</a>
      {!versions.length ? <p data-testid="replay-empty" className="text-xs text-[#8B949E]">{t.empty}</p> : <>
        <label className="block text-xs text-[#8B949E]" htmlFor="replay-world">{t.world}</label>
        <select id="replay-world" data-testid="replay-world-select" value={worldId} disabled={loading || busy} onChange={(e) => setWorldId(e.target.value)} className="pz-field p-2 text-xs w-full">
          {worlds.map((id, i) => <option key={id} value={id}>{t.world} {worlds.length - i} · {versions.find((v) => v.world_id === id)?.label}</option>)}
        </select>
        <p data-testid="replay-rubric" className="text-xs text-[#8B949E] leading-relaxed">{t.rubric}</p>
        <ul className="max-h-48 overflow-y-auto pz-scroll space-y-2">
          {versions.filter((v) => v.world_id === worldId).slice().reverse().map((v, i) => (
            <li key={v.id} data-testid={`replay-node-${i}`} className="flex items-center justify-between gap-2 text-xs">
              <label className="min-w-0 text-[#8B949E] truncate" htmlFor={`rating-${v.id}`}>{i + 1}. {v.label} · {v.parent_id ? t.continuation : t.root}</label>
              <select id={`rating-${v.id}`} data-testid={`replay-rating-${i}`} value={v.rating ?? ""} disabled={loading || busy || (v.id === activeId && draft !== v.final_prompt)} onChange={(e) => onRate(v.id, e.target.value === "" ? null : Number(e.target.value))} className="pz-field p-1.5 text-xs w-24 shrink-0">
                <option value="">{t.unrated}</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
              </select>
            </li>
          ))}
        </ul>
        {active && draft !== active.final_prompt && <p data-testid="replay-edited-warning" className="text-xs text-[#FBBF24]">{t.edited}</p>}
        <p data-testid="replay-readiness" className="text-xs text-[#8B949E]">{trace.rated}/{trace.count} {t.rated}. {trace.count < 2 ? t.needTwo : ""} {!trace.complete ? t.incomplete : ""}</p>
        <button data-testid="replay-run-button" disabled={!trace.ready || loading || busy} onClick={evaluate} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#84CC16]/50 text-xs text-[#84CC16] hover:bg-[#84CC16]/10 disabled:opacity-40 transition-colors">
          {busy && <Loader2 className="w-3 h-3 animate-spin" />}{busy ? t.running : t.run}
        </button>
        <p data-testid="replay-objective" className="text-[10px] font-mono text-[#6E7681]">V = max(s) − 0.02N · W = 1 · β₂ = 0</p>
      </>}
      {error && <p data-testid="replay-error" role="alert" className="text-xs text-[#F87171]">{error}</p>}
      {report && <ReplayResults report={report} t={t} />}
    </section>
  );
};
