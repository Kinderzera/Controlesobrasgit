export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false });
    return;
  }

  const flowUrl = process.env.SHAREPOINT_SERIE_FLOW_URL;
  if (!flowUrl) {
    res.status(500).json({ ok: false, error: "SHAREPOINT_SERIE_FLOW_URL não configurada" });
    return;
  }

  try {
    const upstream = await fetch(flowUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {}),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text || "{}");
  } catch (e) {
    res.status(502).json({ ok: false });
  }
}
