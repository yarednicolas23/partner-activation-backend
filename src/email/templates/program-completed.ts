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

export interface ProgramCompletedEmailParams {
  /** Nombre del partner para el saludo; null usa un saludo genérico. */
  partnerName: string | null;
  /** Cantidad de etapas de la jornada (hoy 5, de la tabla milestones). */
  stageCount: number;
  /**
   * Brindes de la última etapa; vacío oculta el bloque. Este email reemplaza
   * al de "etapa concluída" de la última etapa, así que es el único aviso de
   * que esa recompensa está disponible para resgate.
   */
  rewardTitles: string[];
  /** Destino del botón sin brinde (hoy `${FRONTEND_URL}/dashboard`). */
  ctaUrl: string;
  /** Destino del botón con brinde (hoy `${FRONTEND_URL}/dashboard/rewards`). */
  rewardsUrl: string;
  assetsBaseUrl: string;
}

/**
 * Felicitación al partner por concluir todas las etapas. Reemplaza al email
 * de "etapa concluída" de la última etapa (no se mandan los dos).
 */
export function programCompletedEmail({
  partnerName,
  stageCount,
  rewardTitles,
  ctaUrl,
  rewardsUrl,
  assetsBaseUrl,
}: ProgramCompletedEmailParams): EmailTemplate {
  const greeting = partnerName
    ? `Parabéns, ${escapeHtml(partnerName)}!`
    : 'Parabéns!';

  // Bloque "jornada Kaspersky completa": copa + texto + confeti. En mobile el
  // confeti se oculta para que el texto no quede apretado. El fondo del bloque
  // es el mismo color opaco que trae confeti.png (#EBFEFB).
  const badge = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px 0;background-color:#EBFEFB;border-radius:10px;">
                <tr>
                  <td width="64" style="width:64px;padding:20px 0 20px 20px;vertical-align:middle;">
                    <img src="${assetsBaseUrl}/icon-copa.png" width="48" height="47" alt="" style="display:block;border:0;" />
                  </td>
                  <td style="padding:20px 16px;vertical-align:middle;font-family:${BRAND.headingFont};font-size:26px;line-height:28px;font-weight:900;color:${BRAND.teal};">
                    jornada Kaspersky completa
                  </td>
                  <td class="hide-mobile" width="200" style="width:200px;padding:8px 12px 8px 0;vertical-align:middle;">
                    <img src="${assetsBaseUrl}/confeti.png" width="200" height="92" alt="" style="display:block;border:0;" />
                  </td>
                </tr>
              </table>`;

  // Mismo bloque que stage-completed.ts: disponible para resgate, no "a caminho".
  const hasReward = rewardTitles.length > 0;
  const reward = hasReward
    ? `<p style="margin:0 0 20px 0;font-size:16px;line-height:24px;color:${BRAND.text};">E tem mais uma novidade: <strong style="color:${BRAND.teal};">seu brinde está disponível para <span style="white-space:nowrap;">resgate!</span></strong><span style="white-space:nowrap;">&nbsp;${inlineIcon(assetsBaseUrl, 'gift-dark')}</span></p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;border:2px solid ${BRAND.teal};border-radius:12px;">
                <tr>
                  <td width="40" style="width:40px;padding:12px 0 12px 16px;vertical-align:middle;">${inlineIcon(assetsBaseUrl, 'gift-teal', 28)}</td>
                  <td style="padding:12px 16px;vertical-align:middle;font-family:${BRAND.bodyFont};font-size:16px;line-height:22px;color:${BRAND.text};">Seu brinde: <strong>${escapeHtml(rewardTitles.join(' + '))}</strong></td>
                </tr>
              </table>
              <p style="margin:0 0 20px 0;font-size:16px;line-height:24px;color:${BRAND.text};">Acesse Recompensas para solicitar o seu brinde.</p>`
    : '';

  const body = `<h1 class="h1" style="${STYLES.h1}">
                ${greeting}<br /><span style="color:${BRAND.teal};">Você completou a jornada Kaspersky</span>
              </h1>
              <p style="margin:0 0 20px 0;font-size:16px;line-height:24px;font-weight:bold;color:${BRAND.text};">Você chegou ao final do Kaspersky Partner Quest.</p>
              <p style="${STYLES.p}">As ${stageCount} etapas foram concluídas. Você cumpriu suas missões, conquistou seus reconhecimentos e alcançou o desafio final da jornada: sua primeira venda B2B.</p>

              ${badge}

              <p style="margin:0 0 28px 0;font-size:16px;line-height:24px;color:${BRAND.text};">Essa conquista é sua. Obrigado por fazer parte do Kaspersky Partner Quest e por construir essa jornada com a gente.</p>

              ${reward}
              ${
                hasReward
                  ? renderButton(rewardsUrl, 'Resgatar minha recompensa')
                  : renderButton(ctaUrl, 'Ver minha jornada completa')
              }

              <div style="height:36px;line-height:36px;font-size:1px;">&nbsp;</div>
              <p style="${STYLES.signoff}">Parabéns por essa conquista! 🎉<br />Equipe Kaspersky Partner Quest</p>`;

  return {
    subject: 'Parabéns! Você completou a jornada Kaspersky Partner Quest',
    html: renderLayout({
      preheader: `Você concluiu as ${stageCount} etapas do Kaspersky Partner Quest. Essa conquista é sua!`,
      header: renderHero(assetsBaseUrl, {
        file: 'stage-5-completed-hero.png',
        alt: `Kaspersky Partner Quest — Você completou as ${stageCount} etapas do Kaspersky Partner Quest.`,
      }),
      body,
      assetsBaseUrl,
    }),
  };
}
