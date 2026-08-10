// Vercel Serverless Function — POST /api/login
// Vérifie les identifiants (email + mot de passe) côté serveur, contre les
// variables d'environnement — les identifiants ne sont JAMAIS dans le code.
//
// Corps attendu : { email, password }
// Réponse       : { ok:true, token } si correct, sinon { ok:false, error }
//
// Variables d'environnement requises (à définir dans Vercel) :
//   APP_EMAIL      l'adresse autorisée
//   APP_PASSWORD   le mot de passe

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const EMAIL = process.env.APP_EMAIL;
  const PASS = process.env.APP_PASSWORD;

  // Diagnostic (GET) : indique si l'auth est configurée (aucune valeur révélée)
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      endpoint: "POST /api/login",
      configured: !!EMAIL && !!PASS,
      envSeen: { APP_EMAIL: !!EMAIL, APP_PASSWORD: !!PASS },
    });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Méthode non autorisée" });

  if (!EMAIL || !PASS) {
    return res.status(501).json({
      ok: false,
      error: "Authentification non configurée (APP_EMAIL / APP_PASSWORD manquants dans Vercel)",
    });
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    const email = String((body && body.email) || "").trim().toLowerCase();
    const password = String((body && body.password) || "");

    const okEmail = email === EMAIL.trim().toLowerCase();
    const okPass = password === PASS;
    if (!okEmail || !okPass) {
      return res.status(401).json({ ok: false, error: "Adresse e-mail ou mot de passe incorrect." });
    }

    // Jeton opaque (juste un marqueur « connecté » côté navigateur)
    const token = "sd." + Buffer.from(EMAIL + ":" + PASS.length).toString("base64").replace(/=+$/, "");
    return res.status(200).json({ ok: true, token });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
