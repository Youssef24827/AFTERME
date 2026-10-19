
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  const token = req.query?.token;

  if (
    typeof token !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
  ) {
    return res.status(400).json({
      error: "Lien secret invalide."
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      error: "Configuration serveur incomplète."
    });
  }

  try {
    const baseUrl = supabaseUrl.replace(/\/$/, "");
    const query = new URLSearchParams({
      select: "message,delivery_date,revealed_at",
      token: `eq.${token}`,
      limit: "1"
    });

    const response = await fetch(
      `${baseUrl}/rest/v1/messages?${query.toString()}`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );

    if (!response.ok) {
      return res.status(500).json({
        error: "Impossible de vérifier le lien."
      });
    }

    const rows = await response.json();
    const saved = rows[0];

    if (!saved) {
      return res.status(404).json({
        error: "Ce lien secret est introuvable."
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    if (today < saved.delivery_date) {
      return res.status(423).json({
        locked: true,
        delivery_date: saved.delivery_date,
        message: "Ton message est encore dans le futur."
      });
    }

    if (!saved.revealed_at) {
      const updateQuery = new URLSearchParams({
        token: `eq.${token}`
      });

      await fetch(
        `${baseUrl}/rest/v1/messages?${updateQuery.toString()}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            revealed_at: new Date().toISOString()
          })
        }
      );
    }

    return res.status(200).json({
      locked: false,
      message: saved.message,
      delivery_date: saved.delivery_date
    });
  } catch {
    return res.status(500).json({
      error: "Une erreur est survenue. Réessaie plus tard."
    });
  }
}
