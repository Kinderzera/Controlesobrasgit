import { requireSession } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  const flowUrl = process.env.SHAREPOINT_HISTORICO_FLOW_URL;
  if (!flowUrl) {
    res.status(500).json({ ok: false, error: "SHAREPOINT_HISTORICO_FLOW_URL não configurada" });
    return;
  }

  const body = {
    ...(req.body || {}),
    unidade: session.unitLabel,
    usuario: session.displayName,
  };

  try {
    const upstream = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    res.status(upstream.ok ? 200 : upstream.status).json({ ok: upstream.ok });
  } catch (e) {
    res.status(502).json({ ok: false });
  }
}
