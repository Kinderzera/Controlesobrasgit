import { redisCmd } from "./_lib/redis.js";

const USERS_KEY = "sobras:users";

function loadEnvUsers() {
  try {
    return JSON.parse(process.env.SOBRAS_USERS_JSON || "[]");
  } catch (e) {
    return [];
  }
}

function isAdmin(actingUser) {
  const norm = String(actingUser || "").trim().toLowerCase();
  if (!norm) return false;
  const found = loadEnvUsers().find((u) => u.username === norm);
  return !!(found && found.role === "admin");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const { action, actingUser } = req.body || {};

  if (!isAdmin(actingUser)) {
    res.status(403).json({ ok: false, error: "Sem permissão" });
    return;
  }

  try {
    if (action === "list") {
      const raw = (await redisCmd(["HGETALL", USERS_KEY])) || [];
      const users = [];
      for (let i = 0; i < raw.length; i += 2) {
        let val = {};
        try {
          val = JSON.parse(raw[i + 1]);
        } catch (e) {
          val = {};
        }
        users.push({
          username: raw[i],
          unit: val.unit || "",
          unitLabel: val.unitLabel || "",
          displayName: val.displayName || "",
        });
      }
      res.status(200).json({ ok: true, users });
      return;
    }

    if (action === "create") {
      const novo = (req.body && req.body.novo) || {};
      const username = String(novo.username || "").trim().toLowerCase();
      const password = String(novo.password || "");
      const unit = String(novo.unit || "");
      const unitLabel = String(novo.unitLabel || "");
      const displayName = String(novo.displayName || "").trim();

      if (!username || !password || !unit || !unitLabel || !displayName) {
        res.status(400).json({ ok: false, error: "Preencha todos os campos" });
        return;
      }

      const existsInRedis = await redisCmd(["HGET", USERS_KEY, username]);
      const existsInEnv = loadEnvUsers().some((u) => u.username === username);
      if (existsInRedis || existsInEnv) {
        res.status(409).json({ ok: false, error: "Usuário já existe" });
        return;
      }

      await redisCmd([
        "HSET",
        USERS_KEY,
        username,
        JSON.stringify({ password, unit, unitLabel, displayName }),
      ]);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ ok: false, error: "Ação inválida" });
  } catch (e) {
    res.status(502).json({ ok: false, error: "Erro ao acessar armazenamento" });
  }
}
