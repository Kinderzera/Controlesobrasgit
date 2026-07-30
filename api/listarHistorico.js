import { requireSession } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  const listUrl = process.env.SHAREPOINT_HISTORICO_LIST_FLOW_URL;
  if (!listUrl) {
    res.status(500).json({ ok: false, error: "SHAREPOINT_HISTORICO_LIST_FLOW_URL não configurada" });
    return;
  }

  const unitLabel = session.role === "admin" ? (req.body || {}).unitLabel : session.unitLabel;

  try {
    const upstream = await fetch(listUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unidade: unitLabel || "" }),
    });

    if (!upstream.ok) {
      res.status(upstream.status).json({ ok: false });
      return;
    }

    const raw = await upstream.json();
    const items = Array.isArray(raw) ? raw : [];

    const mapped = items
      .filter((it) => !unitLabel || it.UNIDADE === unitLabel)
      .map((it) => ({
        action: it.ACAO || "",
        code: it.SKU || "",
        qty:
          typeof it.QUANTIDADE === "number"
            ? it.QUANTIDADE
            : parseInt(it.QUANTIDADE, 10) || 0,
        unitLabel: it.UNIDADE || "",
        user: it.USUARIO || "",
        ts: it.Created || it.Modified || null,
      }));

    res.status(200).json({ ok: true, items: mapped });
  } catch (e) {
    res.status(502).json({ ok: false });
  }
}
