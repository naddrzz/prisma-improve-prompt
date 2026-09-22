import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, SlidersHorizontal, Server, Loader2, PlugZap } from "lucide-react";
import { testProvider } from "@/lib/api";

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[10px] font-mono uppercase tracking-wider text-[#6E7681]">{label}</label>
    {children}
  </div>
);

const select = "pz-field px-3 py-2 text-sm w-full appearance-none cursor-pointer";

export const SettingsPanel = ({ t, settings, onChange, provider, onProviderChange }) => {
  const [open, setOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const set = (k) => (e) => onChange({ ...settings, [k]: e.target.value });
  const setP = (k) => (e) => onProviderChange({ ...provider, [k]: e.target.value });

  const runTest = async () => {
    if (!provider.base_url.trim() || !provider.model.trim()) {
      toast.error(t.customIncomplete);
      return;
    }
    setTesting(true);
    try {
      const res = await testProvider({
        base_url: provider.base_url,
        model: provider.model,
        api_key: provider.api_key,
      });
      toast.success(`${t.testOk} · ${res.model}`);
    } catch (e) {
      toast.error(`${t.testFail}: ${t.errors[e.message] || e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const langLabel =
    settings.output_language === "auto" ? "AUTO" : settings.output_language.toUpperCase();

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
            {langLabel} · {t.lenses[settings.lens]}
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div data-testid="settings-body" className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-4 pz-rise">
          <Field label={t.outputLanguage}>
            <select data-testid="setting-output-language" className={select} value={settings.output_language} onChange={set("output_language")}>
              <option value="auto">{t.langAuto}</option>
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

          <div className="sm:col-span-2 border-t border-[#30363D] pt-4 mt-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#F0F6FC] flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-[#38BDF8]" />
                {t.customProvider}
              </span>
              <button
                data-testid="custom-provider-toggle"
                onClick={() => onProviderChange({ ...provider, enabled: !provider.enabled })}
                className={`relative h-5 w-9 rounded-full transition-colors ${provider.enabled ? "bg-[#84CC16]" : "bg-[#30363D]"}`}
                aria-label={t.enableCustom}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-[#0D1117] transition-all ${provider.enabled ? "left-[1.15rem]" : "left-0.5"}`}
                />
              </button>
            </div>
            <p className="text-[10px] text-[#6E7681] mt-2 leading-relaxed">{t.customProviderHint}</p>

            {provider.enabled && (
              <div data-testid="custom-provider-fields" className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pz-rise">
                <Field label={t.baseUrl}>
                  <input
                    data-testid="provider-base-url"
                    className="pz-field px-3 py-2 text-sm w-full font-mono"
                    placeholder={t.baseUrlPlaceholder}
                    value={provider.base_url}
                    onChange={setP("base_url")}
                  />
                </Field>
                <Field label={t.modelId}>
                  <input
                    data-testid="provider-model-id"
                    className="pz-field px-3 py-2 text-sm w-full font-mono"
                    placeholder={t.modelIdPlaceholder}
                    value={provider.model}
                    onChange={setP("model")}
                  />
                </Field>
                <Field label={t.apiKey}>
                  <input
                    data-testid="provider-api-key"
                    type="password"
                    autoComplete="off"
                    className="pz-field px-3 py-2 text-sm w-full font-mono"
                    placeholder={t.apiKeyPlaceholder}
                    value={provider.api_key}
                    onChange={setP("api_key")}
                  />
                </Field>
                <div className="flex items-end">
                  <button
                    data-testid="test-provider-button"
                    onClick={runTest}
                    disabled={testing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#38BDF8]/50 text-xs font-semibold text-[#38BDF8] hover:bg-[#38BDF8]/10 disabled:opacity-50 transition-colors"
                  >
                    {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                    {testing ? t.testing : t.testConnection}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
