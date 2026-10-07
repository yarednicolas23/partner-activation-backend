import {
  BRAND,
  renderButton,
  renderHero,
  renderLayout,
  SIGNOFF_ADMIN,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface LoginLinkEmailParams {
  /** Magic link de un solo uso generado por Supabase (`generateLink`). */
  actionLink: string;
  /** Rol del destinatario: cambia imagen, textos y firma. */
  role: 'partner' | 'admin';
  assetsBaseUrl: string;
}

const COPY = {
  partner: {
    hero: {
      file: 'acceso-partner.png',
      alt: 'Kaspersky Partner Quest — Clique para entrar na sua jornada com segurança.',
    },
    intro: `Use o botão abaixo para entrar no Kaspersky Partner Quest com segurança <strong style="color:${BRAND.teal};">sem precisar de senha.</strong>`,
    button: 'Entrar no Kaspersky Partner Quest',
    signoff: `<p style="${STYLES.signoff}">Até já!<br />Equipe Kaspersky Partner Quest</p>`,
    subject: 'Seu link de acesso ao Kaspersky Partner Quest',
  },
  admin: {
    hero: {
      file: 'acceso-admin.png',
      alt: 'Kaspersky Partner Quest — Clique para entrar no Portal Admin com segurança.',
    },
    intro:
      'Use o botão abaixo para entrar no Portal Admin do Kaspersky Partner Quest com segurança — sem precisar de senha.',
    button: 'Entrar no Portal Admin',
    signoff: SIGNOFF_ADMIN,
    subject: 'Seu link de acesso ao Portal Admin — Kaspersky Partner Quest',
  },
};

/** Magic link que el propio usuario pide en /login o /admin/login. */
export function loginLinkEmail({
  actionLink,
  role,
  assetsBaseUrl,
}: LoginLinkEmailParams): EmailTemplate {
  const copy = COPY[role];

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Seu link de <span style="color:${BRAND.teal};">acesso</span>
              </h1>
              <p style="margin:0 0 28px 0;font-size:16px;line-height:24px;color:${BRAND.text};">${copy.intro}</p>

              ${renderButton(actionLink, copy.button)}

              <p style="${STYLES.note}">Por segurança, este link expira em poucos minutos e só pode ser usado uma vez.<br />Se você não solicitou este acesso, pode ignorar este e-mail.</p>
              ${copy.signoff}`;

  return {
    subject: copy.subject,
    html: renderLayout({
      preheader:
        'Seu link de acesso chegou. Ele expira em poucos minutos e só pode ser usado uma vez.',
      header: renderHero(assetsBaseUrl, copy.hero),
      body,
      assetsBaseUrl,
    }),
  };
}
