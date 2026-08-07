// Vercel Serverless Function — GET /api/generate
// Récupère la page live Snapdesk côté serveur (= pas de CORS), parse le JSON
// embarqué, et renvoie la liste des espaces en JSON.
//
// Le rendu HTML de l'email est fait dans le navigateur (index.html) pour que
// l'édition soit instantanée — cette fonction ne fait que la récupération.
//
// Réponse : { ok, count, generatedFrom, spaces:[{slug,name,workstations,price,postalCode,photo}] }

const DEFAULT_SRC = "https://espaces.snapdesk.co/espaces";

/* ---------- PARSING du JSON embarqué (payload RSC échappé) ---------- */
function parseSpaces(html) {
  const t = html.split('\\"').join('"').split('\\/').join('/');
  const spaces = [], seen = new Set(), idxs = [];
  const re = /"slug":"([^"]+)"/g; let m;
  while ((m = re.exec(t))) idxs.push([m.index, m[1]]);
  for (let k = 0; k < idxs.length; k++) {
    const i = idxs[k][0], slug = idxs[k][1];
    const end = (k + 1 < idxs.length) ? idxs[k + 1][0] : Math.min(i + 8000, t.length);
    const win = t.slice(i, end);
    const name  = win.match(/"name":"((?:[^"\\]|\\.)*)"/);
    const ws    = win.match(/"workstations":(\d+)/);
    const price = win.match(/"pricePerMonth":\s*"?([^",}]+)"?/);
    const pc    = win.match(/"postalCode":"?(\d+)"?/);
    if (!(name && ws && price)) continue;              // pas un objet "espace"
    const priceVal = price[1].replace(/\D/g, "");      // "8 100" ou "7800" -> chiffres
    if (!priceVal) continue;
    if (seen.has(slug)) continue; seen.add(slug);
    let photo = "";
    const pm = win.match(/"photos":\[([\s\S]*?)\]/);
    if (pm && pm[1].trim()) {
      const fp = pm[1].match(/https:\/\/[^"]+?\.(?:jpg|jpeg|png|webp)/);
      if (fp) photo = fp[0];
    }
    spaces.push({
      slug,
      name: name[1],
      workstations: +ws[1],
      price: +priceVal,
      postalCode: pc ? pc[1] : "",
      photo,
    });
  }
  spaces.sort((a, b) => a.workstations - b.workstations);
  return spaces;
}

/* ---------- Handler Vercel ---------- */
module.exports = async (req, res) => {
  try {
    const src = (req.query && req.query.url) || DEFAULT_SRC;
    const r = await fetch(src, { headers: { "User-Agent": "Mozilla/5.0 (snapdesk-mail-generator)" } });
    if (!r.ok) throw new Error("Récupération page échouée (HTTP " + r.status + ")");
    const html = await r.text();
    const spaces = parseSpaces(html);
    if (!spaces.length) throw new Error("Aucun espace trouvé dans la page (structure changée ?)");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ ok: true, count: spaces.length, generatedFrom: src, spaces });
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e) });
  }
};
