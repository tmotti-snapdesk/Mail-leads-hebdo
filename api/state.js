// Vercel Serverless Function — /api/state
// Contenu PARTAGÉ de l'app entre tous les postes (textes, infos, boutons, liens,
// et URLs des photos). Stocké dans Supabase Storage : bucket + "app-state/state.json".
//
//   GET  -> { ok:true, state:<objet>|null }        (null si rien encore enregistré)
//   POST -> enregistre { state:<objet> } (jeton d'auth requis si l'auth est configurée)
//
// Variables d'environnement (déjà présentes pour les photos) :
//   SUPABASE_URL, SUPABASE_SECRET_KEY | SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET (défaut "espaces")
//   APP_EMAIL, APP_PASSWORD  (pour vérifier le jeton en écriture — même logique que /api/login)

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-sd-auth");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const BUCKET = process.env.SUPABASE_BUCKET || "espaces";
  const PATH = "app-state/state.json";
  if (!URL || !KEY) {
    return res.status(501).json({ ok: false, error: "Supabase non configuré (SUPABASE_URL / clé manquante)" });
  }
  const objectUrl = `${URL}/storage/v1/object/${BUCKET}/${PATH}`;

  // ---- Lecture du contenu partagé ----
  if (req.method === "GET") {
    try {
      const r = await fetch(objectUrl, { headers: { Authorization: `Bearer ${KEY}`, apikey: KEY } });
      if (r.status === 404 || r.status === 400) return res.status(200).json({ ok: true, state: null });
      if (!r.ok) {
        const t = await r.text();
        return res.status(200).json({ ok: false, state: null, error: "Supabase " + r.status + " " + t.slice(0, 200) });
      }
      const txt = await r.text();
      let state = null;
      try { state = JSON.parse(txt); } catch (e) {}
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, state });
    } catch (e) {
      return res.status(200).json({ ok: false, state: null, error: String((e && e.message) || e) });
    }
  }

  // ---- Écriture du contenu partagé ----
  if (req.method === "POST") {
    const EMAIL = process.env.APP_EMAIL, PASS = process.env.APP_PASSWORD;
    if (EMAIL && PASS) {
      const expected = "sd." + Buffer.from(EMAIL + ":" + PASS.length).toString("base64").replace(/=+$/, "");
      const got = req.headers["x-sd-auth"] || "";
      if (got !== expected) return res.status(401).json({ ok: false, error: "Non autorisé (jeton invalide)" });
    }
    try {
      let body = req.body;
      if (typeof body === "string") body = JSON.parse(body);
      const state = body && body.state;
      if (!state || typeof state !== "object") throw new Error("État manquant dans la requête");
      const payload = Buffer.from(JSON.stringify(state), "utf8");
      const up = await fetch(objectUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          apikey: KEY,
          "Content-Type": "application/json",
          "x-upsert": "true",
          "cache-control": "no-cache",
        },
        body: payload,
      });
      if (!up.ok) {
        const t = await up.text();
        throw new Error("Supabase " + up.status + " : " + t.slice(0, 200));
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
    }
  }

  return res.status(405).json({ ok: false, error: "Méthode non autorisée" });
};
