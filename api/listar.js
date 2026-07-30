import { requireSession } from "./_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const session = requireSession(req, res);
  if (!session) return;

  const listUrl = process.env.SHAREPOINT_LIST_FLOW_URL;
  if (!listUrl) {
    res.status(500).json({ ok: false, error: "SHAREPOINT_LIST_FLOW_URL não configurada" });
    return;
  }

  // Quem não é admin só pode listar a própria unidade — a unidade pedida
  // pelo cliente é ignorada e substituída pela da sessão verificada.
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
      .filter((it) => !unitLabel || it.Unidade === unitLabel)
      .map((it) => ({
        spId: it.ID,
        code: it.SKU || it.Title || "",
        desc: it.Descricao || "",
        qty:
          typeof it.Quantidade === "number"
            ? it.Quantidade
            : parseInt(it.Quantidade, 10) || 0,
        unitLabel: it.Unidade || "",
        user: it.Usuario || "",
        ts: it.Created || it.Modified || null,
      }));

    res.status(200).json({ ok: true, items: mapped });
  } catch (e) {
    res.status(502).json({ ok: false });
  }
}
