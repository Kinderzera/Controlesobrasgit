export default function handler(req, res) {
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
  const match = users.find(
    (u) => u.username === norm && u.password === senha
  );

  if (!match) {
    res.status(401).json({ ok: false });
    return;
  }

  res.status(200).json({
    ok: true,
    unit: match.unit,
    unitLabel: match.unitLabel,
    displayName: match.displayName,
  });
}
