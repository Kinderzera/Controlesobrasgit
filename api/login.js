import {
  redisCmd,
  getClientIp,
  ACCESS_LOG_KEY,
  ACCESS_LOG_MAX,
} from "./_lib/redis.js";
import { createSessionToken } from "./_lib/auth.js";

const USERS_KEY = "sobras:users";

async function logAccess(req, username) {
  try {
    await redisCmd([
      "LPUSH",
      ACCESS_LOG_KEY,
      JSON.stringify({
        username,
        ip: getClientIp(req),
        ts: new Date().toISOString(),
      }),
    ]);
    await redisCmd(["LTRIM", ACCESS_LOG_KEY, "0", String(ACCESS_LOG_MAX - 1)]);
  } catch (e) {
    // Registro de acesso é best-effort — não pode derrubar o login.
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  let users = [];
  try {
    users = JSON.parse(process.env.SOBRAS_USERS_JSON || "[]");
  } catch (e) {
    users = [];
  }

  const { usuario, senha } = req.body || {};
  const norm = String(usuario || "").trim().toLowerCase();

  const envMatch = users.find(
    (u) => u.username === norm && u.password === senha
  );
  if (envMatch) {
    await logAccess(req, norm);
    const session = {
      username: norm,
      unit: envMatch.unit,
      unitLabel: envMatch.unitLabel,
      displayName: envMatch.displayName,
      role: envMatch.role || "user",
    };
    let token;
    try {
      token = createSessionToken(session);
    } catch (e) {
      res.status(500).json({ ok: false, error: "SESSION_SECRET não configurada" });
      return;
    }
    res.status(200).json({ ok: true, token, ...session });
    return;
  }

  // Usuários cadastrados pela tela de Usuários (perfil admin) ficam no Redis,
  // não na variável de ambiente. Se o Redis não estiver configurado ainda ou
  // o usuário não existir lá, cai no 401 normal (sem quebrar o login).
  try {
    const raw = await redisCmd(["HGET", USERS_KEY, norm]);
    if (raw) {
      const stored = JSON.parse(raw);
      if (stored.password === senha) {
        await logAccess(req, norm);
        const session = {
          username: norm,
          unit: stored.unit,
          unitLabel: stored.unitLabel,
          displayName: stored.displayName,
          role: stored.role || "user",
        };
        let token;
        try {
          token = createSessionToken(session);
        } catch (e) {
          res.status(500).json({ ok: false, error: "SESSION_SECRET não configurada" });
          return;
        }
        res.status(200).json({ ok: true, token, ...session });
        return;
      }
    }
  } catch (e) {
    // Redis indisponível/não configurado — segue como usuário não encontrado.
  }

  res.status(401).json({ ok: false });
}
