import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const fetchConfig = async () => {
  const { data } = await axios.get(`${API}/config`);
  return data;
};

export const processPrompt = async (payload) => {
  try {
    const { data } = await axios.post(`${API}/prompt/process`, payload, { timeout: 250000 });
    return data;
  } catch (err) {
    const code = err?.response?.data?.detail;
    throw new Error(typeof code === "string" ? code : "NETWORK");
  }
};

export const streamPrompt = async (payload, { onDelta, onResult, onReset, onStatus, signal }) => {
  const res = await fetch(`${API}/prompt/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    let code = "NETWORK";
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") code = body.detail;
    } catch (e) {
      /* keep NETWORK */
    }
    throw new Error(code);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop();
      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const msg = JSON.parse(line.slice(6));
        if (msg.type === "delta") onDelta(msg.text);
        else if (msg.type === "reset") onReset?.();
        else if (msg.type === "status") onStatus?.(msg);
        else if (msg.type === "result") onResult(msg.data);
        else if (msg.type === "error") throw new Error(msg.code);
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
};

export const evaluateReplay = async (payload) => {
  try {
    const { data } = await axios.post(`${API}/replay/evaluate`, payload, { timeout: 15000 });
    return data;
  } catch (err) {
    const code = err?.response?.data?.detail;
    throw new Error(typeof code === "string" ? code : "REPLAY_INVALID");
  }
};

export const testProvider = async (provider) => {
  try {
    const { data } = await axios.post(`${API}/provider/test`, provider, { timeout: 60000 });
    return data;
  } catch (err) {
    const code = err?.response?.data?.detail;
    throw new Error(typeof code === "string" ? code : "NETWORK");
  }
};
