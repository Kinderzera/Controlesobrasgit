import { redisCmd, ACCESS_LOG_KEY } from "./_lib/redis.js";
import { requireSession } from "./_lib/auth.js";

const USERS_KEY = "sobras:users";

function loadEnvUsers() {
  try {
    return JSON.parse(process.env.SOBRAS_USERS_JSON || "[]");
  } catch (e) {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  // O papel (admin/user) vem da sessão assinada no login, não de um campo
  // enviado pelo cliente — não dá pra "virar admin" só mandando outro nome.
  if (session.role !== "admin") {
    res.status(403).json({ ok: false, error: "Sem permissão" });
    return;
  }

  const { action } = req.body || {};
  const actingUser = session.username;

  try {
    if (action === "list") {
      const users = [];

      // Usuários fixos, cadastrados na variável de ambiente SOBRAS_USERS_JSON.
      loadEnvUsers().forEach((u) => {
        users.push({
          username: u.username || "",
          password: u.password || "",
          unit: u.unit || "",
          unitLabel: u.unitLabel || "",
          displayName: u.displayName || "",
          role: u.role || "user",
          source: "env",
        });
      });

      // Usuários cadastrados pela própria tela (ficam no Redis).
      const raw = (await redisCmd(["HGETALL", USERS_KEY])) || [];
      for (let i = 0; i < raw.length; i += 2) {
        let val = {};
        try {
          val = JSON.parse(raw[i + 1]);
        } catch (e) {
          val = {};
        }
        users.push({
          username: raw[i],
          password: val.password || "",
          unit: val.unit || "",
          unitLabel: val.unitLabel || "",
          displayName: val.displayName || "",
          role: val.role || "user",
          source: "redis",
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

    if (action === "changePassword") {
      const alvo = String((req.body && req.body.username) || "")
        .trim()
        .toLowerCase();
      const newPassword = String((req.body && req.body.password) || "");

      if (!alvo || !newPassword) {
        res.status(400).json({ ok: false, error: "Preencha usuário e senha" });
        return;
      }
      if (loadEnvUsers().some((u) => u.username === alvo)) {
        res.status(400).json({
          ok: false,
          error: "Esse usuário é fixo (variável de ambiente) e não pode ser editado por aqui",
        });
        return;
      }

      const raw = await redisCmd(["HGET", USERS_KEY, alvo]);
      if (!raw) {
        res.status(404).json({ ok: false, error: "Usuário não encontrado" });
        return;
      }
      let val = {};
      try {
        val = JSON.parse(raw);
      } catch (e) {
        val = {};
      }
      val.password = newPassword;
      await redisCmd(["HSET", USERS_KEY, alvo, JSON.stringify(val)]);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === "delete") {
      const alvo = String((req.body && req.body.username) || "")
        .trim()
        .toLowerCase();
      const acting = String(actingUser || "").trim().toLowerCase();

      if (!alvo) {
        res.status(400).json({ ok: false, error: "Usuário inválido" });
        return;
      }
      if (alvo === acting) {
        res
          .status(400)
          .json({ ok: false, error: "Não é possível excluir o próprio usuário logado" });
        return;
      }
      if (loadEnvUsers().some((u) => u.username === alvo)) {
        res.status(400).json({
          ok: false,
          error: "Esse usuário é fixo (variável de ambiente) e não pode ser excluído por aqui",
        });
        return;
      }

      await redisCmd(["HDEL", USERS_KEY, alvo]);
      res.status(200).json({ ok: true });
      return;
    }

    if (action === "accessLog") {
      const raw = (await redisCmd(["LRANGE", ACCESS_LOG_KEY, "0", "49"])) || [];
      const logs = raw
        .map((s) => {
          try {
            return JSON.parse(s);
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);
      res.status(200).json({ ok: true, logs });
      return;
    }

    res.status(400).json({ ok: false, error: "Ação inválida" });
  } catch (e) {
    res.status(502).json({ ok: false, error: "Erro ao acessar armazenamento" });
  }
}
