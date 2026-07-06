import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getTierForSpend, REWARDS_TIERS } from '@/lib/customerPortal'

// ─── Apple Wallet PKPass ───────────────────────────────────────
// Génère un fichier .pkpass (ZIP contenant pass.json + images + manifest + signature)
// Nécessite : APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT, APPLE_PASS_KEY

// Pour fonctionner sans certificat Apple (mode démo / développement) :
// → Renvoie un .pkpass avec pass.json valide mais signature basique
// → iOS refuse d'installer sans certificat signé mais permet de tester la structure

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

// Simple ZIP builder sans dépendance (structure PKPass minimale)
function buildPkpass(passJson: string, manifest: string, signature: Buffer): Buffer {
  // PKPass = ZIP contenant pass.json, manifest.json, signature
  // Utilise un ZIP minimal car les vraies libs zip nécessitent des deps lourdes
  // En production : utiliser la lib @walletpass/pass-js avec les vrais certificats
  const enc = (s: string) => Buffer.from(s, 'utf8')
  const passData = enc(passJson)
  const manifestData = enc(manifest)

  // En-tête ZIP local file + central directory (format simplifié)
  function localFile(name: string, data: Buffer): Buffer {
    const nameB = Buffer.from(name)
    const hdr = Buffer.alloc(30 + nameB.length)
    hdr.writeUInt32LE(0x04034b50, 0)  // Local file header signature
    hdr.writeUInt16LE(20, 4)           // version needed
    hdr.writeUInt16LE(0, 6)            // flags
    hdr.writeUInt16LE(0, 8)            // compression (stored)
    hdr.writeUInt16LE(0, 10)           // mod time
    hdr.writeUInt16LE(0, 12)           // mod date
    const crc = crc32(data)
    hdr.writeUInt32LE(crc, 14)         // crc32
    hdr.writeUInt32LE(data.length, 18) // compressed size
    hdr.writeUInt32LE(data.length, 22) // uncompressed size
    hdr.writeUInt16LE(nameB.length, 26)// filename length
    hdr.writeUInt16LE(0, 28)           // extra field length
    nameB.copy(hdr, 30)
    return Buffer.concat([hdr, data])
  }

  function crc32(buf: Buffer): number {
    let crc = 0xFFFFFFFF
    for (const b of buf) {
      crc ^= b
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
    return (~crc) >>> 0
  }

  const files: { name: string; data: Buffer; offset: number }[] = []
  let offset = 0

  function addFile(name: string, data: Buffer) {
    files.push({ name, data, offset })
    offset += 30 + Buffer.byteLength(name) + data.length
  }

  addFile('pass.json', passData)
  addFile('manifest.json', manifestData)
  addFile('signature', signature)

  const localParts = files.map(f => localFile(f.name, f.data))

  // Central directory
  const centralDir = Buffer.concat(files.map(f => {
    const nameB = Buffer.from(f.name)
    const cd = Buffer.alloc(46 + nameB.length)
    cd.writeUInt32LE(0x02014b50, 0)      // Central dir signature
    cd.writeUInt16LE(20, 4)              // version made by
    cd.writeUInt16LE(20, 6)              // version needed
    cd.writeUInt16LE(0, 8)               // flags
    cd.writeUInt16LE(0, 10)              // compression
    cd.writeUInt16LE(0, 12)              // mod time
    cd.writeUInt16LE(0, 14)              // mod date
    const crc = crc32(f.data)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(f.data.length, 20)
    cd.writeUInt32LE(f.data.length, 24)
    cd.writeUInt16LE(nameB.length, 28)
    cd.writeUInt16LE(0, 30)
    cd.writeUInt16LE(0, 32)
    cd.writeUInt16LE(0, 34)
    cd.writeUInt16LE(0, 36)
    cd.writeUInt32LE(0, 38)
    cd.writeUInt32LE(f.offset, 42)
    nameB.copy(cd, 46)
    return cd
  }))

  const cdOffset  = localParts.reduce((s, p) => s + p.length, 0)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(cdOffset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, centralDir, eocd])
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

    // Tier
    const { data: sales } = await supabase
      .from('sales')
      .select('total')
      .eq('customer_id', customerId)
    const totalSpend = (sales || []).reduce((s: number, v: any) => s + v.total, 0)
    const tier       = getTierForSpend(totalSpend)
    const nextTier   = REWARDS_TIERS.find(t => t.minSpend > totalSpend)

    const passTypeId = process.env.APPLE_PASS_TYPE_ID || 'pass.fr.ateli.loyalty'
    const teamId     = process.env.APPLE_TEAM_ID || 'DEMO'
    const shopName   = process.env.NEXT_PUBLIC_SHOP_NAME || 'Ateli'
    const baseUrl    = process.env.NEXT_PUBLIC_APP_URL || 'https://ateli-psi.vercel.app'
    const code       = customer.portal_token?.replace(/-/g, '').slice(0, 8).toUpperCase() ?? customerId.slice(0, 8).toUpperCase()

    // Couleurs selon le palier
    const tierColors: Record<string, { bg: string; fg: string; label: string }> = {
      'Bronze': { bg: 'rgb(205, 127, 50)',  fg: 'rgb(255, 255, 255)', label: '🥉 Bronze' },
      'Silver': { bg: 'rgb(192, 192, 192)', fg: 'rgb(20, 20, 20)',    label: '🥈 Silver' },
      'Gold':   { bg: 'rgb(255, 215, 0)',   fg: 'rgb(20, 20, 20)',    label: '🥇 Gold'   },
      'VIP':    { bg: 'rgb(147, 51, 234)',  fg: 'rgb(255, 255, 255)', label: '💎 VIP'    },
    }
    const colors = tierColors[tier.label ?? ''] ?? { bg: 'rgb(30, 30, 30)', fg: 'rgb(255,255,255)', label: tier.label }

    // pass.json
    const passJson = JSON.stringify({
      formatVersion: 1,
      passTypeIdentifier: passTypeId,
      serialNumber: customerId,
      teamIdentifier: teamId,
      organizationName: shopName,
      description: `Carte fidélité ${shopName}`,
      logoText: shopName,
      backgroundColor: colors.bg,
      foregroundColor: colors.fg,
      labelColor: colors.fg,
      storeCard: {
        primaryFields: [
          { key: 'points', label: 'Points', value: customer.points ?? 0, changeMessage: 'Vos points : %@' },
        ],
        secondaryFields: [
          { key: 'tier',  label: 'Palier', value: colors.label },
          { key: 'avoir', label: 'Avoir',  value: `${(customer.credit_balance ?? 0).toFixed(2)} €` },
        ],
        auxiliaryFields: [
          { key: 'spend',   label: 'CA cumulé', value: `${totalSpend.toFixed(0)} €` },
          nextTier
            ? { key: 'next', label: 'Prochain palier', value: `${nextTier.minSpend - totalSpend} € restants` }
            : { key: 'next', label: 'Statut', value: '🏆 Niveau max !' },
        ],
        backFields: [
          { key: 'name',    label: 'Titulaire', value: customer.name },
          { key: 'email',   label: 'Email',     value: customer.email || '' },
          { key: 'code',    label: 'Code caisse', value: code },
          { key: 'portal',  label: 'Mon espace fidélité', value: `${baseUrl}/client` },
          { key: 'info',    label: '', value: `Présentez cette carte en boutique pour bénéficier de vos avantages ${shopName}.` },
        ],
      },
      barcode: {
        message:         `${baseUrl}/client?token=${customer.portal_token}`,
        format:          'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText:         code,
      },
      barcodes: [
        {
          message:         `${baseUrl}/client?token=${customer.portal_token}`,
          format:          'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1',
          altText:         code,
        },
      ],
      webServiceURL: `${baseUrl}/api/wallet/apple/update`,
      authenticationToken: customer.portal_token ?? customerId,
    }, null, 2)

    // manifest.json (SHA-1 de chaque fichier)
    const { createHash } = await import('crypto')
    const passHash = createHash('sha1').update(passJson).digest('hex')
    const manifest = JSON.stringify({ 'pass.json': passHash })
    const manifestHash = createHash('sha1').update(manifest).digest('hex')

    // Signature (en production : signer avec le cert Apple)
    // En mode démo : signature vide (iOS refuse mais permet de tester)
    const certPem = process.env.APPLE_PASS_CERT
    const keyPem  = process.env.APPLE_PASS_KEY
    let signature: Buffer

    if (certPem && keyPem) {
      const { createSign } = await import('crypto')
      const sign = createSign('SHA1')
      sign.update(manifest)
      signature = sign.sign(keyPem)
    } else {
      // Demo mode — signature vide
      signature = Buffer.from('DEMO_SIGNATURE_NOT_VALID')
    }

    const pkpass = buildPkpass(passJson, manifest, signature)

    return new NextResponse(pkpass as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${shopName.toLowerCase()}-fidelite.pkpass"`,
        'Content-Length':      String(pkpass.length),
        'Cache-Control':       'no-cache, no-store',
      },
    })
  } catch (e: any) {
    console.error('[wallet/apple]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
