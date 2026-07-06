import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTierForSpend, REWARDS_TIERS } from '@/lib/customerPortal'

// ─── Google Wallet Loyalty Card ───────────────────────────────
// Génère un JWT signé pour créer une carte de fidélité dans Google Wallet.
// Nécessite GOOGLE_WALLET_ISSUER_ID et GOOGLE_WALLET_KEY_JSON dans .env

function getSupabase() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

// Encode base64url (sans dépendance externe)
function base64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function signJWT(payload: object, secret: string): string {
  // Pour Google Wallet en mode "unsigned" (test), on utilise RS256 avec une clé JSON
  // En production, remplacer par la vraie signature RSA avec la clé Google
  const header  = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body    = base64url(JSON.stringify(payload))
  // Sans clé RSA réelle → on retourne un JWT non signé (suffisant pour le deep link)
  return `${header}.${body}.unsigned`
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const customerId = searchParams.get('customer_id')
    if (!customerId) return NextResponse.json({ error: 'customer_id requis' }, { status: 400 })

    const supabase = getSupabase()
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name, email, points, credit_balance, portal_token')
      .eq('id', customerId)
      .single()

    if (!customer) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

    // Calcul du tier
    const { data: sales } = await supabase
      .from('sales')
      .select('total')
      .eq('customer_id', customerId)
    const totalSpend = (sales || []).reduce((s: number, v: any) => s + v.total, 0)
    const tier       = getTierForSpend(totalSpend)
    const nextTier   = REWARDS_TIERS.find(t => t.minSpend > totalSpend)

    const issuerId  = process.env.GOOGLE_WALLET_ISSUER_ID || 'DEMO_ISSUER'
    const classId   = `${issuerId}.ateli_loyalty`
    const objectId  = `${issuerId}.customer_${customerId.replace(/-/g, '_')}`
    const shopName  = process.env.NEXT_PUBLIC_SHOP_NAME || 'Ateli'
    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL || 'https://ateli-psi.vercel.app'

    // Google Wallet Loyalty Object
    const loyaltyObject = {
      id:      objectId,
      classId: classId,
      state:   'ACTIVE',
      accountId:   customerId,
      accountName: customer.name,
      loyaltyPoints: {
        label: 'Points',
        balance: { int: customer.points ?? 0 },
      },
      secondaryLoyaltyPoints: {
        label: 'Avoir',
        balance: { money: { micros: Math.round((customer.credit_balance ?? 0) * 1_000_000), currencyCode: 'EUR' } },
      },
      textModulesData: [
        { header: 'Palier', body: tier.label ?? 'Bronze', id: 'tier' },
        { header: 'CA cumulé', body: `${totalSpend.toFixed(0)} €`, id: 'spend' },
        nextTier
          ? { header: 'Prochain palier', body: `${nextTier.label} à ${nextTier.minSpend} €`, id: 'next' }
          : { header: 'Statut', body: '🏆 Palier maximum', id: 'next' },
        { header: 'Code caisse', body: customer.portal_token?.slice(0, 8).toUpperCase() ?? '', id: 'code' },
      ],
      barcode: {
        type:          'QR_CODE',
        value:         `${baseUrl}/client?token=${customer.portal_token}`,
        alternateText: customer.portal_token?.slice(0, 8).toUpperCase() ?? '',
      },
      heroImage: {
        sourceUri: { uri: `${baseUrl}/wallet-hero.png` },
      },
    }

    const payload = {
      iss:     `wallet@${issuerId}.iam.gserviceaccount.com`,
      aud:     'google',
      typ:     'savetowallet',
      iat:     Math.floor(Date.now() / 1000),
      payload: {
        loyaltyObjects: [loyaltyObject],
      },
    }

    // En production : signer avec la clé RSA Google
    const keyJson = process.env.GOOGLE_WALLET_KEY_JSON
    let token: string

    if (keyJson) {
      // Production : signature RSA réelle
      const key = JSON.parse(keyJson)
      const { createSign } = await import('crypto')
      const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
      const body   = base64url(JSON.stringify(payload))
      const sign   = createSign('RSA-SHA256')
      sign.update(`${header}.${body}`)
      const sig = sign.sign(key.private_key, 'base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
      token = `${header}.${body}.${sig}`
    } else {
      // Demo : JWT non signé (pour tester l'intégration)
      token = signJWT(payload, 'demo')
    }

    const saveUrl = `https://pay.google.com/gp/v/save/${token}`

    return NextResponse.json({ url: saveUrl, token })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
