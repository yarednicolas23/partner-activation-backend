/**
 * Renderiza las plantillas de src/email/templates a email-previews/*.html
 * para revisarlas en el navegador sin enviar nada:
 *   npm run email:preview
 * Las imágenes salen de EMAIL_ASSETS_URL (por defecto el frontend local).
 */
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { accessLinkEmail, welcomeEmail } from '../src/email/templates';

const assetsBaseUrl =
  process.env.EMAIL_ASSETS_URL ?? 'http://localhost:3000/emails';
const outDir = join(__dirname, '..', 'email-previews');

const previews = {
  welcome: welcomeEmail({
    ctaUrl: 'http://localhost:3000/login',
    assetsBaseUrl,
  }),
  'access-link': accessLinkEmail({
    actionLink: 'http://localhost:3000/auth/callback#access_token=preview',
    loginUrl: 'http://localhost:3000/login',
    fullName: 'Maria Silva',
    assetsBaseUrl,
  }),
};

mkdirSync(outDir, { recursive: true });
for (const [name, { html }] of Object.entries(previews)) {
  writeFileSync(join(outDir, `${name}.html`), html);
  console.log(`email-previews/${name}.html`);
}
