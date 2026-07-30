import crypto from "crypto";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — dura um turno de trabalho

function toBase64Url(buf) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function sign(encodedPayload, secret) {
  return toBase64Url(crypto.createHmac("sha256", secret).update(encodedPayload).digest());
}

export function createSessionToken(payload) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET não configurada");

  const now = Date.now();
  const body = { ...payload, iat: now, exp: now + SESSION_TTL_MS };
  const encoded = toBase64Url(Buffer.from(JSON.stringify(body), "utf8"));
  const sig = sign(encoded, secret);
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;

  const expected = sign(encoded, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let body;
  try {
    body = JSON.parse(fromBase64Url(encoded).toString("utf8"));
  } catch (e) {
    return null;
  }
  if (!body || typeof body.exp !== "number" || Date.now() > body.exp) return null;
  return body;
}

function getBearerToken(req) {
  const header = req.headers["authorization"] || req.headers["Authorization"];
  if (header && header.startsWith("Bearer ")) return header.slice(7).trim();
  return (req.body && req.body.token) || null;
}

// Usar no topo de toda API que precisa de login. Retorna a sessão (username,
// unit, unitLabel, displayName, role) ou já responde 401 e retorna null.
export function requireSession(req, res) {
  const token = getBearerToken(req);
  const session = verifySessionToken(token);
  if (!session) {
    res.status(401).json({ ok: false, error: "Sessão inválida ou expirada. Faça login novamente." });
    return null;
  }
  return session;
}
