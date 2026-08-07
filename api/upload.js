// Vercel Serverless Function — POST /api/upload
// Reçoit une image (JSON base64), l'envoie sur Supabase Storage côté serveur
// (la clé service_role reste secrète) et renvoie son URL publique.
//
// Corps attendu : { filename, contentType, dataBase64 }
// Réponse       : { ok:true, url:"https://<projet>.supabase.co/storage/v1/object/public/<bucket>/<path>" }
//
// Variables d'environnement requises (à définir dans Vercel) :
//   SUPABASE_URL                 ex: https://xxxxxxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    (Settings → API → service_role) — SECRET
//   SUPABASE_BUCKET              (optionnel, défaut: "espaces")

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  // Diagnostic (GET) : montre quelles variables le serveur voit (booléens uniquement, aucune valeur secrète)
  if (req.method === "GET") {
    // ?test=1 : tente un vrai upload d'une image 1x1 et renvoie la réponse EXACTE de Supabase
    if (req.query && req.query.test) {
      const U = process.env.SUPABASE_URL;
      const K = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      const B = process.env.SUPABASE_BUCKET || "espaces";
      if (!U || !K) return res.status(200).json({ ok: false, step: "env", error: "URL ou clé manquante" });
      try {
        const png = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==",
          "base64"
        );
        const up = await fetch(`${U}/storage/v1/object/${B}/_diagnostic/test.png`, {
          method: "POST",
          headers: { Authorization: `Bearer ${K}`, apikey: K, "Content-Type": "image/png", "x-upsert": "true" },
          body: png,
        });
        const body = await up.text();
        return res.status(200).json({
          ok: up.ok,
          supabaseStatus: up.status,
          supabaseBody: body.slice(0, 400),
          publicUrl: up.ok ? `${U}/storage/v1/object/public/${B}/_diagnostic/test.png` : null,
        });
      } catch (e) {
        return res.status(200).json({ ok: false, step: "fetch", error: String((e && e.message) || e) });
      }
    }
    return res.status(200).json({
      ok: true,
      endpoint: "POST /api/upload",
      envSeen: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_SECRET_KEY: !!process.env.SUPABASE_SECRET_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_BUCKET: process.env.SUPABASE_BUCKET || null,
        urlEndsWithSupabase: /\.supabase\.co\/?$/.test(process.env.SUPABASE_URL || ""),
      },
    });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Méthode non autorisée" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  // Nouveau format Supabase: clé "secret" (sb_secret_...). On accepte aussi
  // l'ancien nom service_role pour compatibilité.
  const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const BUCKET = process.env.SUPABASE_BUCKET || "espaces";

  if (!SUPABASE_URL || !KEY) {
    return res.status(501).json({
      ok: false,
      error: "Supabase non configuré (SUPABASE_URL / SUPABASE_SECRET_KEY manquants)",
    });
  }

  try {
    // Corps JSON (peut arriver déjà parsé ou en string selon le runtime)
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    if (!body || !body.dataBase64) throw new Error("Aucune image reçue");

    const contentType = body.contentType || "image/jpeg";
    const ext = (contentType.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const safe = String(body.filename || "photo")
      .toLowerCase()
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "photo";
    // Nom unique sans Date.now() interdit ici : on combine taille + fragment aléatoire léger
    const buffer = Buffer.from(body.dataBase64, "base64");
    const rand = Math.abs(hashCode(body.dataBase64.slice(0, 64) + safe + buffer.length)).toString(36);
    const path = `${safe}-${buffer.length}-${rand}.${ext}`;

    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        "Content-Type": contentType,
        "x-upsert": "true",
        "cache-control": "31536000",
      },
      body: buffer,
    });

    if (!up.ok) {
      const txt = await up.text();
      throw new Error("Supabase " + up.status + " : " + txt.slice(0, 200));
    }

    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    return res.status(200).json({ ok: true, url });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}
