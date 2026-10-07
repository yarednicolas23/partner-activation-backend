import {
  BRAND,
  escapeHtml,
  renderButton,
  renderHero,
  renderLayout,
  SIGNOFF,
  STYLES,
  WELCOME_HERO,
} from './layout';
import { EmailTemplate } from './types';

export interface AccessLinkEmailParams {
  /** Magic link de un solo uso generado por Supabase (`generateLink`). */
  actionLink: string;
  /** Página para pedir un link nuevo si este expira (`${FRONTEND_URL}/login`). */
  loginUrl?: string;
  fullName?: string | null;
  assetsBaseUrl: string;
}

/**
 * Reenvío de la invitación (botón "reenviar convite" del admin). El link que
 * pide el propio usuario en /login usa login-link.ts.
 */
export function accessLinkEmail({
  actionLink,
  loginUrl,
  fullName,
  assetsBaseUrl,
}: AccessLinkEmailParams): EmailTemplate {
  const greeting = fullName ? `Olá, ${escapeHtml(fullName)}!` : 'Olá!';
  const expiry = loginUrl
    ? ` Se ele expirar, solicite um novo em <a href="${escapeHtml(loginUrl)}" target="_blank" style="color:${BRAND.muted};">${escapeHtml(loginUrl)}</a>.`
    : '';

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Bem-vindo ao <span style="color:${BRAND.teal};">Kaspersky Partner Quest!</span>
              </h1>
              <p style="${STYLES.p}">${greeting}</p>
              <p style="${STYLES.p}">Você foi convidado para o Kaspersky Partner Quest, o programa que acompanha cada passo da sua trajetória como parceiro Kaspersky ao longo de 5 etapas.</p>
              <p style="${STYLES.lead}">Use o botão abaixo para entrar na plataforma e continuar sua jornada.</p>

              ${renderButton(actionLink, 'Acessar o Kaspersky Partner Quest')}

              <p style="${STYLES.note}">Este link é de uso único e expira em breve.${expiry}</p>
              ${SIGNOFF}`;

  return {
    subject: 'Bem-vindo ao Kaspersky Partner Quest!',
    html: renderLayout({
      preheader:
        'Seu link de acesso ao Kaspersky Partner Quest chegou. Ele é de uso único e expira em breve.',
      header: renderHero(assetsBaseUrl, WELCOME_HERO),
      body,
      assetsBaseUrl,
    }),
  };
}
