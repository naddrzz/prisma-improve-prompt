// Trace metadata stays in React memory. Replay requests contain scores and IDs only.
export const requestKey = (payload) => JSON.stringify([
  payload.mode, payload.prompt, payload.context, payload.settings,
  payload.provider?.base_url || "default", payload.provider?.model || "default",
]);

export const recordVersion = (versions, payload, data, label, activeId) => {
  const key = requestKey(payload);
  const parent = versions.find((v) => v.id === activeId);
  const canContinue = payload.current_result && parent?.request_key === key
    && parent.final_prompt === payload.current_result
    && !versions.some((v) => v.parent_id === parent.id);
  const root = !payload.current_result && versions.find((v) => v.request_key === key && !v.parent_id && !v.snapshot.current_result);
  return {
    id: crypto.randomUUID(), label, final_prompt: data.final_prompt, data,
    world_id: canContinue ? parent.world_id : root?.world_id || crypto.randomUUID(),
    parent_id: canContinue ? parent.id : null,
    request_key: key, rating: null, created_at: new Date().toISOString(),
    snapshot: {
      mode: payload.mode, prompt: payload.prompt, context: payload.context,
      settings: { ...payload.settings }, current_result: payload.current_result || "",
      instruction: payload.instruction || "",
    },
  };
};

export const buildWorld = (versions, worldId) => {
  const nodes = versions.filter((v) => v.world_id === worldId).slice().reverse();
  const ids = new Set(nodes.map((v) => v.id));
  const complete = nodes.every((v) => !v.parent_id || ids.has(v.parent_id));
  const rated = nodes.every((v) => v.rating !== null);
  return {
    ready: nodes.length >= 2 && complete && rated,
    complete, count: nodes.length, rated: nodes.filter((v) => v.rating !== null).length,
    world: { id: worldId, baseline_score: 0, nodes: nodes.map((v) => ({
      id: v.id, parent_id: v.parent_id, score: v.rating === null ? null : v.rating / 5,
    })) },
  };
};
