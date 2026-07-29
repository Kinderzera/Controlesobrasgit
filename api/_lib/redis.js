const REDIS_URL =
  process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN =
  process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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
