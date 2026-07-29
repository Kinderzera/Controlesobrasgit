const REDIS_URL =
  process.env.REDIS_KV_REST_API_URL ||
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN =
  process.env.REDIS_KV_REST_API_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN;

export const ACCESS_LOG_KEY = "sobras:access_log";
export const ACCESS_LOG_MAX = 200;

export function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) {
    return String(fwd).split(",")[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || "";
}

export async function redisCmd(cmd) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Armazenamento de usuários (Redis) não configurado");
  }

  const resp = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });

  const data = await resp.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data.result;
}
