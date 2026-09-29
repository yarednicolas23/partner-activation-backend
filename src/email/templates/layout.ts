/**
 * Estructura compartida por todos los emails del programa: contenedor de
 * 600px, bloque de contenido y footer (redes + logo Kaspersky).
 *
 * Reglas de HTML para email (Gmail/Outlook ignoran casi todo el CSS moderno):
 * - Layout solo con <table>, estilos inline, sin flexbox/grid.
 * - Imágenes siempre con URL absoluta y en PNG/JPG (SVG y WebP no se ven en
 *   Gmail/Outlook). Se sirven desde `frontend/public/emails/`.
 */

export const BRAND = {
  teal: '#5FC8B0',
  text: '#1D1D1B',
  muted: '#6B6B6B',
  border: '#E3E3E3',
  pageBg: '#F4F4F4',
  // Kaspersky Sans no está disponible en clientes de correo: se usa como
  // primera opción (Apple Mail con la fuente instalada) y cae en Arial.
  headingFont: "'Kaspersky Sans', 'Arial Black', Arial, Helvetica, sans-serif",
  bodyFont: 'Arial, Helvetica, sans-serif',
};

// Pendiente confirmar con Kaspersky si se usan las cuentas globales o las de
// Kaspersky Brasil.
const SOCIAL_LINKS = [
  {
    name: 'Facebook',
    icon: 'facebook',
    url: 'https://www.facebook.com/Kaspersky',
  },
  { name: 'X', icon: 'x', url: 'https://x.com/kaspersky' },
  {
    name: 'LinkedIn',
    icon: 'linkedin',
    url: 'https://www.linkedin.com/company/kaspersky-lab',
  },
  {
    name: 'Instagram',
    icon: 'instagram',
    url: 'https://www.instagram.com/kasperskylab',
  },
  {
    name: 'YouTube',
    icon: 'youtube',
    url: 'https://www.youtube.com/@Kaspersky',
  },
];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Hero del programa: una sola imagen que ya incluye el logo Partner Quest y
 * el titular — por eso el `alt` repite el titular: si el cliente bloquea
 * imágenes, el mensaje se sigue leyendo.
 */
export function renderHero(assetsBaseUrl: string): string {
  return `<tr>
            <td style="background-color:#EEF3F2;">
              <img src="${assetsBaseUrl}/welcome-hero.png" width="600" height="252" alt="Kaspersky Partner Quest — Sua jornada no Kaspersky Partner Quest começa agora." style="display:block;width:100%;max-width:600px;height:auto;border:0;font-family:${BRAND.bodyFont};font-size:18px;color:${BRAND.text};" />
            </td>
          </tr>`;
}

/** Botón principal; el bloque VML le da esquinas redondeadas en Outlook. */
export function renderButton(url: string, label: string): string {
  const href = escapeHtml(url);
  return `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:380px;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:${BRAND.teal};">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:52px;v-text-anchor:middle;width:380px;" arcsize="20%" stroke="f" fillcolor="${BRAND.teal}">
                      <center style="color:#FFFFFF;font-family:Arial,sans-serif;font-size:18px;">${label}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${href}" target="_blank" style="display:block;padding:15px 24px;font-family:${BRAND.bodyFont};font-size:18px;line-height:22px;color:#FFFFFF;text-decoration:none;border-radius:10px;">${label}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`;
}

export const STYLES = {
  h1: `margin:0 0 12px 0;font-family:${BRAND.headingFont};font-size:21px;line-height:28px;font-weight:900;letter-spacing:0.5px;text-transform:uppercase;color:${BRAND.text};`,
  p: `margin:0 0 20px 0;font-size:16px;line-height:24px;color:${BRAND.text};`,
  lead: `margin:0 0 28px 0;font-size:18px;line-height:26px;font-weight:bold;color:${BRAND.text};`,
  note: `margin:14px 0 36px 0;font-size:13px;line-height:18px;font-style:italic;color:${BRAND.muted};`,
  signoff: `margin:0;font-size:16px;line-height:22px;color:${BRAND.text};`,
};

export const SIGNOFF = `<p style="${STYLES.signoff}">Boa jornada!<br />Equipe Kaspersky Partner Quest</p>`;

export interface LayoutParams {
  /** Texto oculto que los clientes muestran junto al asunto en la bandeja. */
  preheader: string;
  /** Fila(s) <tr> que van arriba del contenido (ej. imagen hero). */
  header?: string;
  /** HTML del cuerpo, ya dentro de la celda con padding. */
  body: string;
  assetsBaseUrl: string;
}

export function renderLayout({
  preheader,
  header = '',
  body,
  assetsBaseUrl,
}: LayoutParams): string {
  const socialIcons = SOCIAL_LINKS.map(
    (s) => `<td style="padding:0 10px;">
                <a href="${s.url}" target="_blank" style="text-decoration:none;">
                  <img src="${assetsBaseUrl}/icons/${s.icon}.png" width="24" height="24" alt="${s.name}" style="display:block;border:0;outline:none;" />
                </a>
              </td>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Kaspersky Partner Quest</title>
  <!--[if mso]><style>table,td,a,p,h1{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
  <style>
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; }
      .px { padding-left: 24px !important; padding-right: 24px !important; }
      .h1 { font-size: 22px !important; line-height: 28px !important; }
      .btn a { display: block !important; }
      .social-label { display: block !important; padding-bottom: 12px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.pageBg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.pageBg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#FFFFFF;border:1px solid ${BRAND.border};">
          ${header}
          <tr>
            <td class="px" style="padding:40px 48px 32px 48px;font-family:${BRAND.bodyFont};color:${BRAND.text};">
              ${body}
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:32px 48px 40px 48px;border-top:1px solid ${BRAND.border};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="social-label" style="padding-right:30px;font-family:${BRAND.bodyFont};font-size:18px;color:${BRAND.muted};white-space:nowrap;">Siga a Kaspersky:</td>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${socialIcons}</tr></table>
                  </td>
                </tr>
              </table>
              <img src="${assetsBaseUrl}/kaspersky-logo.png" width="180" height="37" alt="Kaspersky" style="display:block;border:0;margin-top:36px;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
