import {
  BRAND,
  escapeHtml,
  renderButton,
  renderHero,
  renderLayout,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface ProgramCompletedEmailParams {
  /** Nombre del partner para el saludo; null usa un saludo genérico. */
  partnerName: string | null;
  /** Etapas de la jornada en orden (hoy las 5, de la tabla milestones). */
  stages: { number: number; title: string }[];
  /** Destino del botón (hoy `${FRONTEND_URL}/dashboard/rewards`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

function inlineIcon(assetsBaseUrl: string, icon: string, size = 18): string {
  return `<img src="${assetsBaseUrl}/icons/${icon}.png" width="${size}" height="${size}" alt="" style="display:inline-block;vertical-align:middle;border:0;" />`;
}

/** Felicitación al partner por concluir todas las etapas del programa. */
export function programCompletedEmail({
  partnerName,
  stages,
  ctaUrl,
  assetsBaseUrl,
}: ProgramCompletedEmailParams): EmailTemplate {
  const greeting = partnerName
    ? `Parabéns, ${escapeHtml(partnerName)}!`
    : 'Parabéns!';

  const stageRows = stages
    .map(
      (stage, i) => `<tr>
                  <td style="padding:12px 18px;${i > 0 ? `border-top:1px solid ${BRAND.border};` : ''}font-family:${BRAND.bodyFont};font-size:16px;line-height:22px;color:${BRAND.text};">
                    ${inlineIcon(assetsBaseUrl, 'trophy-teal')}&nbsp; <strong>Etapa ${stage.number}</strong> · ${escapeHtml(stage.title)}
                  </td>
                </tr>`,
    )
    .join('');

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Você concluiu o <span style="color:${BRAND.teal};">Kaspersky Partner Quest!</span> ${inlineIcon(assetsBaseUrl, 'trophy-dark', 22)}
              </h1>
              <p style="${STYLES.p}"><strong>${greeting}</strong> Você completou todas as missões e concluiu as ${stages.length} etapas da jornada:</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;background-color:#EEF2F5;">
                ${stageRows}
              </table>

              <p style="${STYLES.p}">Obrigado por fazer parte do programa e por cada conquista ao longo do caminho. Acompanhe suas recompensas na plataforma.</p>

              <div style="height:8px;line-height:8px;font-size:1px;">&nbsp;</div>
              ${renderButton(ctaUrl, 'Ver minhas recompensas')}

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              <p style="${STYLES.signoff}">Parabéns pela jornada!<br />Equipe Kaspersky Partner Quest</p>`;

  return {
    subject: 'Você concluiu o Kaspersky Partner Quest!',
    html: renderLayout({
      preheader: `Você concluiu as ${stages.length} etapas da jornada. Parabéns por essa conquista!`,
      header: renderHero(assetsBaseUrl, {
        file: 'program-completed-hero.png',
        // 1200×544 como los heroes de etapa: la cinta "Stage completed"
        // sobresale por arriba (franja transparente).
        height: 272,
        alt: 'Kaspersky Partner Quest — Você concluiu o Kaspersky Partner Quest!',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
