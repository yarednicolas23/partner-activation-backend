import {
  BRAND,
  escapeHtml,
  renderButton,
  renderHero,
  renderLayout,
  SIGNOFF,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface ReminderEmailParams {
  partnerName: string | null;
  /** Missões pendentes na etapa atual. */
  pendingCount: number;
  /** Destino del botón (hoy `${FRONTEND_URL}/dashboard`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

/** Recordatorio semanal al partner inactivo con misiones pendientes. */
export function reminderEmail({
  partnerName,
  pendingCount,
  ctaUrl,
  assetsBaseUrl,
}: ReminderEmailParams): EmailTemplate {
  const greeting = partnerName ? `Olá, ${escapeHtml(partnerName)}!` : 'Olá!';
  const missions =
    pendingCount === 1
      ? '1 missão pendente'
      : `${pendingCount} missões pendentes`;

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Sua jornada <span style="color:${BRAND.teal};">espera por você</span>
              </h1>
              <p style="${STYLES.p}">${greeting}</p>
              <p style="${STYLES.p}">Você tem <strong>${missions}</strong> na sua etapa atual do Kaspersky Partner Quest. Cada missão concluída aproxima você da próxima conquista e das recompensas do programa.</p>
              <p style="${STYLES.lead}">Continue de onde parou e avance na sua jornada.</p>

              ${renderButton(ctaUrl, 'Continuar minha jornada')}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              ${SIGNOFF}`;

  return {
    subject: 'Você tem missões pendentes no Kaspersky Partner Quest',
    html: renderLayout({
      preheader: `Você tem ${missions} na sua etapa atual. Continue sua jornada.`,
      header: renderHero(assetsBaseUrl, {
        file: 'reminder-hero.png',
        alt: 'Kaspersky Partner Quest — Sua jornada espera por você.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
