import { redisCmd } from "./_lib/redis.js";

const USERS_KEY = "sobras:users";

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
    res.status(200).json({
      ok: true,
      unit: envMatch.unit,
      unitLabel: envMatch.unitLabel,
      displayName: envMatch.displayName,
      role: envMatch.role || "user",
    });
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
        res.status(200).json({
          ok: true,
          unit: stored.unit,
          unitLabel: stored.unitLabel,
          displayName: stored.displayName,
          role: stored.role || "user",
        });
        return;
      }
    }
  } catch (e) {
    res.status(401).json({ ok: false, debug: String((e && e.message) || e) });
    return;
  }

  res.status(401).json({ ok: false });
}
