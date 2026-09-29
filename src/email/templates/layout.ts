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
