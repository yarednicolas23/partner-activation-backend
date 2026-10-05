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
 * Hero de cada email: una sola imagen (1200px de ancho, 2x) que ya incluye el
 * logo Partner Quest y el titular — por eso `alt` debe repetir el titular: si
 * el cliente bloquea imágenes, el mensaje se sigue leyendo.
 */
export function renderHero(
  assetsBaseUrl: string,
  hero: {
    file: string;
    alt: string;
    /** Alto a 600px de ancho (mitad del alto real de la imagen 2x). */
    height?: number;
  },
): string {
  return `<tr>
            <td style="background-color:#FFFFFF;">
              <img src="${assetsBaseUrl}/${hero.file}" width="600" height="${hero.height ?? 252}" alt="${escapeHtml(hero.alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;font-family:${BRAND.bodyFont};font-size:18px;color:${BRAND.text};" />
            </td>
          </tr>`;
}

export const WELCOME_HERO = {
  file: 'welcome-hero.png',
  alt: 'Kaspersky Partner Quest — Sua jornada no Kaspersky Partner Quest começa agora.',
};

/**
 * Botón principal. Sin VML de tamaño fijo: el texto puede pasar a dos líneas
 * en pantallas angostas en vez de cortarse. En Outlook de escritorio el
 * padding va en la celda (mso-padding-alt) y las esquinas quedan rectas.
 */
export function renderButton(url: string, label: string): string {
  const href = escapeHtml(url);
  return `<table role="presentation" class="btn" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:380px;">
                <tr>
                  <td align="center" bgcolor="${BRAND.teal}" style="border-radius:10px;background-color:${BRAND.teal};mso-padding-alt:15px 24px;">
                    <a href="${href}" target="_blank" style="display:block;padding:15px 24px;font-family:${BRAND.bodyFont};font-size:18px;line-height:22px;color:#FFFFFF;text-decoration:none;border-radius:10px;mso-padding-alt:0;">${label}</a>
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

// Los partners (y quien revisa) están en Brasil: la fecha se muestra en
// horario de São Paulo aunque el backend corra en UTC.
export function formatDateTimeBR(date: Date): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('day')}/${get('month')}/${get('year')} às ${get('hour')}:${get('minute')}`;
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
      .btn a { font-size: 16px !important; padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.pageBg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BRAND.pageBg};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border:1px solid ${BRAND.border};">
          ${header}
          <tr>
            <td class="px" style="padding:40px 48px 32px 48px;font-family:${BRAND.bodyFont};color:${BRAND.text};">
              ${body}
            </td>
          </tr>
          <tr>
            <td class="px" style="padding:32px 48px 40px 48px;border-top:1px solid ${BRAND.border};">
              <!-- Dos tablas align="left": lado a lado en escritorio y una debajo
                   de la otra cuando no entran (celular), sin depender de media
                   queries. Antes, con nowrap en una sola fila, el pie forzaba
                   ~445px de ancho y el correo se cortaba en el celular. -->
              <table role="presentation" align="left" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 30px 12px 0;font-family:${BRAND.bodyFont};font-size:18px;line-height:24px;color:${BRAND.muted};white-space:nowrap;">Siga a Kaspersky:</td>
                </tr>
              </table>
              <table role="presentation" align="left" cellpadding="0" cellspacing="0" border="0" style="margin-left:-10px;">
                <tr>${socialIcons}</tr>
              </table>
              <div style="clear:both;line-height:0;font-size:0;">&nbsp;</div>
              <img src="${assetsBaseUrl}/kaspersky-logo.png" width="180" height="37" alt="Kaspersky" style="display:block;border:0;margin-top:36px;" />
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
