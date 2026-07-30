import { requireSession } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  const flowUrl = process.env.SHAREPOINT_FLOW_URL;
  if (!flowUrl) {
    res.status(500).json({ ok: false, error: "SHAREPOINT_FLOW_URL não configurada" });
    return;
  }

  // unidade/usuario sempre vêm da sessão verificada no servidor, nunca do
  // corpo enviado pelo cliente — impede forjar lançamentos em nome de outra
  // pessoa ou de outra unidade.
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
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text || "{}");
  } catch (e) {
    res.status(502).json({ ok: false });
  }
}
