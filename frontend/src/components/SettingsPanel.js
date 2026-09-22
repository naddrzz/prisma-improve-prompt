import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-mono uppercase tracking-wider text-[#6E7681]">{label}</label>
    {children}
  </div>
);

const select = "pz-field px-3 py-2 text-sm w-full appearance-none cursor-pointer";

export const SettingsPanel = ({ t, settings, onChange }) => {
  const [open, setOpen] = useState(false);
  const set = (k) => (e) => onChange({ ...settings, [k]: e.target.value });

  return (
    <div className="border border-[#30363D] rounded-xl bg-[#0D1117] overflow-hidden">
      <button
        data-testid="settings-toggle"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm text-[#8B949E] hover:text-[#F0F6FC] transition-colors"
      >
        <span className="flex items-center gap-2 font-medium">
          <SlidersHorizontal className="h-4 w-4" />
          {t.settings}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase text-[#84CC16]">
            {settings.output_language.toUpperCase()} · {t.lenses[settings.lens]}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div data-testid="settings-body" className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 pz-rise">
          <Field label={t.outputLanguage}>
            <select data-testid="setting-output-language" className={select} value={settings.output_language} onChange={set("output_language")}>
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label={t.depth}>
            <select data-testid="setting-depth" className={select} value={settings.depth} onChange={set("depth")}>
              {Object.entries(t.depths).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label={t.audience}>
            <input
              data-testid="setting-audience"
              className="pz-field px-3 py-2 text-sm w-full"
              placeholder={t.audiencePlaceholder}
              value={settings.audience}
              onChange={set("audience")}
            />
          </Field>
          <Field label={t.tone}>
            <select data-testid="setting-tone" className={select} value={settings.tone} onChange={set("tone")}>
              {Object.entries(t.tones).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label={t.lens}>
            <select data-testid="setting-lens" className={select} value={settings.lens} onChange={set("lens")}>
              {Object.entries(t.lenses).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          {settings.lens !== "none" && (
            <Field label={t.lensStrength}>
              <div data-testid="setting-lens-strength" className="inline-flex bg-[#161B22] p-1 rounded-lg border border-[#30363D]">
                {["subtle", "explicit"].map((s) => (
                  <button
                    key={s}
                    data-testid={`lens-strength-${s}`}
                    onClick={() => onChange({ ...settings, lens_strength: s })}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      settings.lens_strength === s ? "bg-[#84CC16] text-[#0D1117] font-semibold" : "text-[#8B949E] hover:text-[#F0F6FC]"
                    }`}
                  >
                    {t.strengths[s]}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </div>
      )}
    </div>
  );
};
