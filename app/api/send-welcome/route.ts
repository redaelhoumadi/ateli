import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { welcomeEmailHtml, welcomeEmailText } from '@/lib/emailTemplates'
import { REWARDS_TIERS } from '@/lib/customerPortal'

// Resend est initialisé ici côté serveur uniquement
// La clé API ne sera jamais exposée au client
function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY non configurée')
  return new Resend(key)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      customerName,
      customerEmail,
      customerId,
      shopName    = 'Ateli',
      shopEmail   = '',
      shopAddress = '',
      fromEmail   = 'noreply@ateli.fr',
      portalBaseUrl,
    } = body

    // Validation
    if (!customerEmail || !customerName || !customerId) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }
    if (!customerEmail.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }

    // Code client = 8 premiers chars de l'UUID sans tirets, en majuscules
    const customerCode = customerId.replace(/-/g, '').slice(0, 8).toUpperCase()
    const origin       = portalBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://ateli.vercel.app'
    const portalUrl    = `${origin}/client`

    const emailData = {
      customerName,
      customerCode,
      portalUrl,
      shopName,
      shopEmail,
      shopAddress,
      tiers: REWARDS_TIERS.map(t => ({
        label:    t.label,
        minSpend: t.minSpend,
        discount: t.discount,
      })),
    }

    const resend = getResend()

    const { data, error } = await resend.emails.send({
      from:    `${shopName} <${fromEmail}>`,
      to:      [customerEmail],
      subject: `🎁 Bienvenue dans le programme fidélité ${shopName} !`,
      html:    welcomeEmailHtml(emailData),
      text:    welcomeEmailText(emailData),
    })

    if (error) {
      console.error('[Resend] error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, emailId: data?.id })
  } catch (err: any) {
    console.error('[send-welcome] error:', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
