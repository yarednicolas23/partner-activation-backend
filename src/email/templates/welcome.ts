import {
  BRAND,
  renderButton,
  renderHero,
  renderLayout,
  SIGNOFF,
  STYLES,
} from './layout';
import { EmailTemplate } from './types';

export interface WelcomeEmailParams {
  /** Destino del botón (hoy `${FRONTEND_URL}/login`). */
  ctaUrl: string;
  assetsBaseUrl: string;
}

/** Email de bienvenida post pre-registro. */
export function welcomeEmail({
  ctaUrl,
  assetsBaseUrl,
}: WelcomeEmailParams): EmailTemplate {
  const body = `<h1 class="h1" style="${STYLES.h1}">
                Bem-vindo ao <span style="color:${BRAND.teal};">Kaspersky Partner Quest!</span>
              </h1>
              <p style="${STYLES.p}">Você foi convidado a participar do Kaspersky Partner Quest, o programa criado para reconhecer sua evolução, valorizar suas conquistas e celebrar cada passo da sua trajetória como parceiro Kaspersky.</p>
              <p style="${STYLES.p}">Ao longo da sua jornada, você vai cumprir 5 etapas, cada uma com missões que ajudam você a avançar, desenvolver novas habilidades, gerar oportunidades e conquistar reconhecimentos.</p>
              <p style="${STYLES.lead}">Pronto para começar? Acesse a plataforma abaixo e dê o primeiro passo.</p>

              ${renderButton(ctaUrl, 'Acessar o Kaspersky Partner Quest')}

              <p style="${STYLES.note}">Não é necessário criar uma senha. Você recebe um link de acesso exclusivo por e-mail.</p>
              ${SIGNOFF}`;

  return {
    subject: 'Bem-vindo ao Kaspersky Partner Quest',
    html: renderLayout({
      preheader:
        'Sua jornada no Kaspersky Partner Quest começa agora. Acesse a plataforma e dê o primeiro passo.',
      header: renderHero(assetsBaseUrl),
      body,
      assetsBaseUrl,
    }),
  };
}
