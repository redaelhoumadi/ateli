// Utilitaire côté client pour envoyer l'email de bienvenue
// Appelle la route API Next.js qui utilise Resend en toute sécurité

type SendWelcomeOptions = {
  customerName:  string
  customerEmail: string
  customerId:    string
  // Infos boutique depuis les settings
  shopName?:     string
  shopEmail?:    string
  shopAddress?:  string
  fromEmail?:    string
}

export async function sendWelcomeEmail(opts: SendWelcomeOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/send-welcome', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...opts,
        portalBaseUrl: window.location.origin,
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      return { success: false, error: json.error || `Erreur ${res.status}` }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur réseau' }
  }
}
