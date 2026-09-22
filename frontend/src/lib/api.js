import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const fetchConfig = async () => {
  const { data } = await axios.get(`${API}/config`);
  return data;
};

export const processPrompt = async (payload) => {
  try {
    const { data } = await axios.post(`${API}/prompt/process`, payload, { timeout: 130000 });
    return data;
  } catch (err) {
    const code = err?.response?.data?.detail;
    throw new Error(typeof code === "string" ? code : "NETWORK");
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
