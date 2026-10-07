import {
  BRAND,
  escapeHtml,
  inlineIcon,
  renderButton,
  renderHero,
  renderLayout,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface StageCompletedEmailParams {
  stageNumber: number;
  stageTitle: string;
  /**
   * Nombre de la conquista desbloqueada. Pendiente de definir con Kaspersky
   * (hoy los milestones no tienen un nombre de conquista propio) — el
   * llamador usa "Etapa N: Título" mientras tanto.
   */
  achievementTitle: string;
  /** Brindes (rewards) asociados a la etapa; vacío oculta el bloque. */
  rewardTitles: string[];
  /** Destino del botón sin brinde (hoy `${FRONTEND_URL}/dashboard`). */
  ctaUrl: string;
  /**
   * Destino del botón cuando la etapa libera brinde (hoy
   * `${FRONTEND_URL}/dashboard/rewards`): el partner tiene que pedirlo.
   */
  rewardsUrl: string;
  assetsBaseUrl: string;
}

/** Felicitación al partner por completar una etapa (milestone). */
export function stageCompletedEmail({
  stageNumber,
  stageTitle,
  achievementTitle,
  rewardTitles,
  ctaUrl,
  rewardsUrl,
  assetsBaseUrl,
}: StageCompletedEmailParams): EmailTemplate {
  // Al completar la etapa el brinde queda disponible para resgate (el partner
  // lo solicita en Recompensas). "A caminho" recién aplica cuando un admin
  // aprueba el resgate (redemption-status.ts).
  const hasReward = rewardTitles.length > 0;
  const reward = hasReward
    ? `<p style="margin:28px 0 20px 0;font-size:16px;line-height:24px;color:${BRAND.text};">E tem mais uma novidade: <strong style="color:${BRAND.teal};">seu brinde está disponível para <span style="white-space:nowrap;">resgate!</span></strong><span style="white-space:nowrap;">&nbsp;${inlineIcon(assetsBaseUrl, 'gift-dark')}</span></p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;border:2px solid ${BRAND.teal};border-radius:12px;">
                <tr>
                  <td width="40" style="width:40px;padding:12px 0 12px 16px;vertical-align:middle;">${inlineIcon(assetsBaseUrl, 'gift-teal', 28)}</td>
                  <td style="padding:12px 16px;vertical-align:middle;font-family:${BRAND.bodyFont};font-size:16px;line-height:22px;color:${BRAND.text};">Seu brinde: <strong>${escapeHtml(rewardTitles.join(' + '))}</strong></td>
                </tr>
              </table>`
    : '';

  const body = `<h1 class="h1" style="${STYLES.h1}">
                Parabéns! Você concluiu a <span style="white-space:nowrap;">etapa <span style="color:${BRAND.teal};">${stageNumber}!</span> ${inlineIcon(assetsBaseUrl, 'trophy-dark', 22)}</span>
              </h1>
              <p style="${STYLES.p}">Você completou todas as missões da Etapa ${stageNumber} – ${escapeHtml(stageTitle)} e desbloqueou uma nova conquista:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;">
                <tr>
                  <td style="padding:14px 18px;background-color:#EEF2F5;font-family:${BRAND.bodyFont};font-size:16px;line-height:22px;font-weight:bold;color:${BRAND.text};">
                    ${inlineIcon(assetsBaseUrl, 'trophy-dark')}&nbsp; ${escapeHtml(achievementTitle)}
                  </td>
                </tr>
              </table>
              ${reward}

              <div style="height:28px;line-height:28px;font-size:1px;">&nbsp;</div>
              ${
                hasReward
                  ? `<p style="margin:0 0 20px 0;font-size:16px;line-height:24px;color:${BRAND.text};">Acesse Recompensas para solicitar o seu brinde.</p>
              ${renderButton(rewardsUrl, 'Resgatar minha recompensa')}`
                  : renderButton(ctaUrl, 'Continuar minha jornada')
              }

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              <p style="${STYLES.signoff}">Continue sua jornada Kaspersky Partner Quest!<br />Equipe Kaspersky Partner Quest</p>`;

  return {
    subject: `Parabéns! Você concluiu a Etapa ${stageNumber} – ${stageTitle}`,
    html: renderLayout({
      preheader: `Você desbloqueou uma nova conquista na sua jornada: ${achievementTitle}.`,
      header: renderHero(assetsBaseUrl, {
        // Una ilustración por etapa (el edificio y el marcador cambian).
        file: `stage-${stageNumber}-completed-hero.png`,
        // 1200×544: la cinta "Stage completed" sobresale por arriba del hero
        // (esa franja es transparente).
        height: 272,
        alt: 'Kaspersky Partner Quest — Você desbloqueou uma nova conquista na sua jornada.',
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
