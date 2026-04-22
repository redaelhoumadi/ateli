// Template HTML de l'email de bienvenue
// Rendu minimal pour compatibilité maximale avec les clients email

type WelcomeEmailData = {
  customerName: string
  customerCode: string   // 8 premiers chars de l'UUID
  portalUrl:    string   // lien vers l'espace fidélité
  shopName:     string
  shopEmail?:   string
  shopAddress?: string
  tiers: Array<{ label: string; minSpend: number; discount: number }>
}

export function welcomeEmailHtml(data: WelcomeEmailData): string {
  const { customerName, customerCode, portalUrl, shopName, shopEmail, shopAddress, tiers } = data
  const firstName = customerName.split(' ')[0]
  const tiersHtml = tiers
    .filter(t => t.discount > 0)
    .map(t => `
      <tr>
        <td style="padding:8px 16px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#374151;">
          ${t.label}
        </td>
        <td style="padding:8px 16px;border-bottom:1px solid #F3F4F6;font-size:13px;color:#6B7280;text-align:center;">
          Dès ${t.minSpend} €
        </td>
        <td style="padding:8px 16px;border-bottom:1px solid #F3F4F6;font-size:13px;font-weight:700;color:#059669;text-align:right;">
          -${t.discount}%
        </td>
      </tr>
    `).join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue chez ${shopName} !</title>
</head>
<body style="margin:0;padding:0;background-color:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#111111;border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <div style="display:inline-block;background:#ffffff;border-radius:12px;width:48px;height:48px;line-height:48px;font-size:22px;font-weight:900;color:#111111;text-align:center;margin-bottom:16px;">
                ${shopName.charAt(0).toUpperCase()}
              </div>
              <h1 style="margin:0 0 4px;font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                ${shopName}
              </h1>
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">Programme fidélité</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px;">

              <!-- Greeting -->
              <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111111;">
                Bonjour ${firstName} 👋
              </h2>
              <p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">
                Bienvenue dans le programme fidélité <strong style="color:#111111;">${shopName}</strong> ! 
                Vos achats s'accumulent automatiquement pour vous offrir des réductions de plus en plus généreuses.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${portalUrl}"
                       style="display:inline-block;background:#111111;color:#ffffff;font-size:15px;font-weight:700;
                              text-decoration:none;padding:14px 32px;border-radius:12px;letter-spacing:0.2px;">
                      Accéder à mon espace →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Code client -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#F5F3FF;border-radius:12px;margin-bottom:32px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#7C3AED;text-transform:uppercase;letter-spacing:0.08em;">
                      Votre code client
                    </p>
                    <p style="margin:0 0 8px;font-family:monospace;font-size:26px;font-weight:900;color:#111111;letter-spacing:3px;">
                      ${customerCode}
                    </p>
                    <p style="margin:0;font-size:12px;color:#6B7280;line-height:1.5;">
                      Communiquez ce code en boutique pour bénéficier de vos avantages fidélité.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Paliers -->
              <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#111111;">
                🎁 Vos avantages
              </h3>
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;margin-bottom:32px;">
                <tr style="background:#F9FAFB;">
                  <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;text-align:left;">Palier</th>
                  <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;text-align:center;">Seuil</th>
                  <th style="padding:10px 16px;font-size:11px;font-weight:600;color:#9CA3AF;text-transform:uppercase;text-align:right;">Remise</th>
                </tr>
                ${tiersHtml}
              </table>

              <!-- How it works -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="background:#F0FDF4;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#059669;">✓ Comment ça marche</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#374151;">1. Donnez votre nom ou code en caisse</p>
                    <p style="margin:0 0 6px;font-size:13px;color:#374151;">2. Vos achats s'accumulent automatiquement</p>
                    <p style="margin:0;font-size:13px;color:#374151;">3. Votre remise s'applique dès que vous atteignez un palier</p>
                  </td>
                </tr>
              </table>

              <!-- Portal link -->
              <p style="margin:0;font-size:13px;color:#9CA3AF;text-align:center;">
                Consultez vos achats et avantages à tout moment :<br>
                <a href="${portalUrl}" style="color:#6366F1;text-decoration:none;font-weight:600;">
                  ${portalUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F3F4F6;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
                ${shopName}${shopAddress ? ' · ' + shopAddress : ''}
              </p>
              ${shopEmail ? `<p style="margin:0;font-size:12px;color:#9CA3AF;">${shopEmail}</p>` : ''}
              <p style="margin:8px 0 0;font-size:11px;color:#D1D5DB;">
                Vous recevez cet email car vous avez créé un compte fidélité chez ${shopName}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function welcomeEmailText(data: WelcomeEmailData): string {
  const { customerName, customerCode, portalUrl, shopName, tiers } = data
  const firstName = customerName.split(' ')[0]
  const tiersText = tiers
    .filter(t => t.discount > 0)
    .map(t => `  · ${t.label} : -${t.discount}% dès ${t.minSpend} €`)
    .join('\n')

  return `Bonjour ${firstName},

Bienvenue dans le programme fidélité ${shopName} !

Votre code client : ${customerCode}
Communiquez ce code en boutique pour bénéficier de vos avantages.

Vos avantages fidélité :
${tiersText}

Consultez votre espace : ${portalUrl}

— ${shopName}
`
}
