
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const { message, delivery_date } = req.body || {};

    if (
      typeof message !== "string" ||
      message.trim().length < 1 ||
      message.length > 5000
    ) {
      return res.status(400).json({
        error: "Le message doit contenir entre 1 et 5000 caractères."
      });
    }

    if (
      typeof delivery_date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(delivery_date)
    ) {
      return res.status(400).json({
        error: "Choisis une date valide."
      });
    }

    const date = new Date(`${delivery_date}T00:00:00Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== delivery_date
    ) {
      return res.status(400).json({
        error: "La date est invalide."
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    if (delivery_date <= today) {
      return res.status(400).json({
        error: "Choisis une date future."
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        error: "La configuration du serveur est incomplète."
      });
    }

    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/messages`,
      {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          message: message.trim(),
          delivery_date,
          email: null
        })
      }
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "Impossible de sauvegarder le message."
      });
    }

    const rows = await response.json();
    const saved = rows[0];

    if (!saved || !saved.token) {
      return res.status(500).json({
        error: "Le lien secret n'a pas pu être créé."
      });
    }

    const siteUrl =
      process.env.SITE_URL || "https://afterme-bay.vercel.app";

    const secretLink = new URL("/", siteUrl);
    secretLink.searchParams.set("token", saved.token);

    return res.status(201).json({
      success: true,
      link: secretLink.toString(),
      delivery_date: saved.delivery_date
    });
  } catch {
    return res.status(500).json({
      error: "Une erreur est survenue. Réessaie plus tard."
    });
  }
}
