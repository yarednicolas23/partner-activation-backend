import {
  BRAND,
  escapeHtml,
  renderButton,
  renderHero,
  renderLayout,
  STYLES,
  WELCOME_HERO,
} from './layout';
import { EmailTemplate } from './types';

export interface AdminAccessEmailParams {
  /** Nombre (o email) del admin que concedió el acceso, si se conoce. */
  grantedBy: string | null;
  /** Destino del botón (hoy `${FRONTEND_URL}/admin/login`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

/**
 * Invitación al Portal Admin: se envía cuando un partner es promovido a
 * admin. Mismo formato e imagen que la bienvenida del partner.
 */
export function adminAccessEmail({
  grantedBy,
  ctaUrl,
  assetsBaseUrl,
}: AdminAccessEmailParams): EmailTemplate {
  const intro = grantedBy
    ? `<strong>${escapeHtml(grantedBy)}</strong> concedeu a você acesso de administrador ao Kaspersky Partner Quest.`
    : 'Você recebeu acesso de administrador ao Kaspersky Partner Quest.';

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Bem-vindo ao <span style="color:${BRAND.teal};">Portal Admin!</span>
              </h1>
              <p style="${STYLES.p}">${intro}</p>
              <p style="${STYLES.p}">No Portal Admin você pode convidar parceiros, revisar as comprovações enviadas, acompanhar o progresso de cada etapa e gerenciar as recompensas do programa.</p>
              <p style="${STYLES.lead}">Acesse o Portal Admin abaixo para começar.</p>

              ${renderButton(ctaUrl, 'Acessar o Portal Admin')}

              <p style="${STYLES.note}">Não é necessário criar uma senha. Você recebe um link de acesso exclusivo por e-mail.</p>
              <p style="${STYLES.signoff}">Equipe Kaspersky Partner Quest</p>`;

  return {
    subject: 'Você agora é administrador do Kaspersky Partner Quest',
    html: renderLayout({
      preheader:
        'Seu acesso de administrador foi liberado. Acesse o Portal Admin para começar.',
      header: renderHero(assetsBaseUrl, WELCOME_HERO),
      body,
      assetsBaseUrl,
    }),
  };
}
