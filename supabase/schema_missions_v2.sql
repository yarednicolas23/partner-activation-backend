-- Partner Activation Program (Kaspersky) — etapas e missões v2
-- Ejecutar en el SQL editor de Supabase, después de schema_missions.sql.
--
-- Alinea las 5 etapas y sus missões con el documento "Conteúdo das Telas:
-- Parceiro e Kaspersky" (ISOURCE, 1.1 As 5 Etapas e Missões):
--   * Tipos de comprovação nuevos: e-mail, link, y "choice" (el parceiro
--     elige una opción y la comprovação depende de la opción elegida).
--   * evidence_label: texto de "Comprovação exigida" que ven parceiro y validador.
--   * Etapa 1: se elimina "Download do Sales Kit".
--   * Etapa 2: los 5 canales de comunicación se fusionan en UNA missão
--     ("Divulgar a parceria", canal a elección).
--   * Etapa 3: la ação de geração de demanda pasa a ser "choice" (7 ações).
--   * Comprovações de varias partes (ej. convite + captura + lista) se piden
--     en un único PDF — decisión: 1 archivo por envío.
--
-- Actualiza las filas EN EL LUGAR (por order_index), no re-siembra: borrar
-- milestone_tasks borra en cascada la task_evidence de los parceiros.
-- Todo corre en una sola transacción (el SQL editor manda el script entero).

-- 1. Esquema -----------------------------------------------------------------

-- evidence_type pasa de enum a text + check: ALTER TYPE ... ADD VALUE no se
-- puede usar en la misma transacción que lo agrega, y acá se usa enseguida.
alter table public.milestone_tasks alter column evidence_type drop default;
alter table public.milestone_tasks
  alter column evidence_type type text using evidence_type::text;
alter table public.milestone_tasks alter column evidence_type set default 'text';
alter table public.milestone_tasks
  add constraint milestone_tasks_evidence_type_check
  check (evidence_type in ('none', 'text', 'email', 'url', 'file', 'choice'));
drop type public.evidence_type;

alter table public.milestone_tasks add column evidence_label text;
-- Solo para evidence_type = 'choice': [{ key, label, evidence_type, evidence_label }]
-- donde evidence_type ∈ ('text', 'email', 'url', 'file').
alter table public.milestone_tasks add column evidence_options jsonb;

-- Opción elegida por el parceiro en una missão 'choice' (key de evidence_options).
alter table public.task_evidence add column option_key text;

-- 2. Etapa 1 — Descoberta ------------------------------------------------------

-- Sales Kit (order 4) es evidence_type 'none' — no tiene evidencia que perder.
delete from public.milestone_tasks mt
using public.milestones m
where mt.milestone_id = m.id and m.order_index = 1 and mt.order_index = 4;

update public.milestone_tasks mt set order_index = 4
from public.milestones m
where mt.milestone_id = m.id and m.order_index = 1 and mt.order_index = 5;

-- 3. Etapa 2 — fusionar los 5 canales (orders 5..9) en la order 5 -------------

-- Por parceiro se conserva UNA evidencia entre los 5 canales: la aprobada, si
-- no la pendiente, si no la más reciente. Las demás se descartan (la tabla
-- admite una evidencia por missão y parceiro).
with channel_tasks as (
  select mt.id
  from public.milestone_tasks mt
  join public.milestones m on m.id = mt.milestone_id
  where m.order_index = 2 and mt.order_index between 5 and 9
),
ranked as (
  select e.id,
         row_number() over (
           partition by e.partner_id
           order by case e.status when 'approved' then 0 when 'pending' then 1 else 2 end,
                    e.submitted_at desc
         ) as rn
  from public.task_evidence e
  where e.task_id in (select id from channel_tasks)
)
delete from public.task_evidence where id in (select id from ranked where rn > 1);

-- La evidencia conservada pasa a la missão fusionada, marcando el canal de origen.
update public.task_evidence e
set option_key = case src.order_index
                   when 5 then 'social_media'
                   when 6 then 'email_marketing'
                   when 7 then 'press_release'
                   when 8 then 'blog_post'
                   when 9 then 'site'
                 end,
    task_id = target.id
from public.milestone_tasks src
join public.milestones m on m.id = src.milestone_id and m.order_index = 2,
     public.milestone_tasks target
join public.milestones tm on tm.id = target.milestone_id and tm.order_index = 2
where e.task_id = src.id
  and src.order_index between 5 and 9
  and target.order_index = 5;

delete from public.milestone_tasks mt
using public.milestones m
where mt.milestone_id = m.id and m.order_index = 2 and mt.order_index between 6 and 9;

-- 4. Contenido de etapas y missões ---------------------------------------------

-- description = "Objetivo da etapa" del documento.
update public.milestones m set title = v.title, description = v.description
from (values
  (1, 'Descoberta', 'Onboarding inicial do parceiro'),
  (2, 'Capacitação', 'Treinamento e certificação'),
  (3, 'Engajamento', 'Geração de demanda'),
  (4, 'Prospecção', 'Oportunidade de negócio'),
  (5, 'Conquista', 'Primeira venda B2B')
) as v(order_index, title, description)
where m.order_index = v.order_index;

update public.milestone_tasks mt
set title = v.title,
    description = v.description,
    evidence_type = v.evidence_type,
    evidence_label = v.evidence_label,
    evidence_options = v.evidence_options::jsonb
from public.milestones m,
(values
  -- Etapa 1 — Descoberta
  (1, 1, 'Cadastro no Portal do Parceiro',
   'Automático — o usuário é pré-cadastrado pela Kaspersky e a missão já nasce concluída.',
   'none', 'Nenhuma (concluída automaticamente pelo sistema).', null),
  (1, 2, 'Participar do Webinar de Onboarding Comercial',
   'Assista ao webinar comercial de boas-vindas ao programa.',
   'email', 'E-mail utilizado no cadastro do webinar (validado pela Kaspersky).', null),
  (1, 3, 'Participar do Webinar de Onboarding Técnico',
   'Assista ao webinar técnico de boas-vindas ao programa.',
   'email', 'E-mail utilizado no cadastro do webinar (validado pela Kaspersky).', null),
  (1, 4, 'Incluir o logo Kaspersky no site do parceiro',
   'Adicione o logo/selo de parceria Kaspersky em seu site institucional.',
   'url', 'Link do site onde o logo foi incluído.', null),

  -- Etapa 2 — Capacitação
  (2, 1, 'Completar treinamento online em Vendas no Partner Portal',
   'Treinamento online focado em argumentação comercial da solução.',
   'email', 'E-mail cadastrado no treinamento.', null),
  (2, 2, 'Completar treinamento online Técnico no Partner Portal',
   'Treinamento online focado em implementação/suporte técnico.',
   'email', 'E-mail cadastrado no treinamento.', null),
  (2, 3, 'Obter Certificação em Vendas',
   'Certificação que valida o conhecimento comercial do parceiro.',
   'file', 'Certificado (documento PDF ou JPG).', null),
  (2, 4, 'Obter Certificação Técnica',
   'Certificação que valida o conhecimento técnico do parceiro.',
   'file', 'Certificado (documento PDF ou JPG).', null),
  (2, 5, 'Divulgar a parceria com a Kaspersky',
   'Anuncie a parceria em ao menos 1 canal de comunicação, à sua escolha.',
   'choice', 'Link ou peça/arquivo, conforme o canal de comunicação escolhido.',
   '[
     {"key": "social_media", "label": "Social Media", "evidence_type": "url", "evidence_label": "Link da publicação."},
     {"key": "email_marketing", "label": "E-mail Marketing", "evidence_type": "file", "evidence_label": "Peça/arquivo do e-mail marketing enviado."},
     {"key": "press_release", "label": "Press Release", "evidence_type": "url", "evidence_label": "Link do press release publicado."},
     {"key": "blog_post", "label": "Blog Post", "evidence_type": "url", "evidence_label": "Link do blog post publicado."},
     {"key": "site", "label": "Site próprio", "evidence_type": "url", "evidence_label": "Link da página do site."}
   ]'),

  -- Etapa 3 — Engajamento
  (3, 1, 'Cadastrar a equipe de vendas na plataforma KUDOS',
   'Registre os vendedores da sua empresa na plataforma de incentivo KUDOS.',
   'file', 'Lista de usuários cadastrados (não é necessário print).', null),
  (3, 2, 'Responder ao Quiz de Parceria',
   'Questionário curto sobre o programa de parceria.',
   'email', 'E-mail do respondente do quiz.', null),
  (3, 3, 'Executar 1 Ação de Geração de Demanda',
   'Escolha UMA das ações abaixo. A comprovação exigida muda conforme a ação escolhida.',
   'choice', 'Varia conforme a ação escolhida — envie tudo em um único PDF.',
   '[
     {"key": "webinar", "label": "Webinar para clientes", "evidence_type": "file", "evidence_label": "Convite do webinar + captura de tela + lista de participantes, em um único PDF."},
     {"key": "event", "label": "Evento para clientes", "evidence_type": "file", "evidence_label": "Fotos + lista de participantes + convite do evento, em um único PDF."},
     {"key": "outbound_phone", "label": "Prospecção Outbound — Telemarketing", "evidence_type": "file", "evidence_label": "Script utilizado + lista de contatos, em um único PDF."},
     {"key": "outbound_email", "label": "Prospecção Outbound — E-mail", "evidence_type": "file", "evidence_label": "Captura de tela do e-mail + lista de contatos, em um único PDF."},
     {"key": "social_selling", "label": "Social Selling (posts fornecidos pela Kaspersky)", "evidence_type": "file", "evidence_label": "Captura de tela + links dos posts publicados, em um único PDF."},
     {"key": "potential_clients", "label": "Identificação de 5 clientes potenciais", "evidence_type": "file", "evidence_label": "Lista de clientes + plano de negócio (business plan) por cliente, em um único PDF."},
     {"key": "sales_blitz", "label": "Blitz interna de vendas (KUDOS pode ser usado)", "evidence_type": "file", "evidence_label": "Plano da blitz + lista de contatos + capturas de tela do material de apoio, em um único PDF."}
   ]'),

  -- Etapa 4 — Prospecção
  (4, 1, 'Registrar a primeira Oportunidade (Deal Registration)',
   'Registro formal de uma oportunidade de negócio, previamente aprovada pela Kaspersky.',
   'text', 'Número da oportunidade aprovada.', null),
  (4, 2, 'Agendar uma reunião conjunta com a Kaspersky',
   'Reunião organizada em parceria com o time de vendas Kaspersky.',
   'file', 'Fotos + lista de participantes, em um único PDF.', null),

  -- Etapa 5 — Conquista
  (5, 1, 'Fechar a primeira venda (encerramento de pedido)',
   'Conclusão comercial da primeira venda B2B do parceiro dentro do programa.',
   'text', 'Número do pedido (order number).', null)
) as v(milestone_order, order_index, title, description, evidence_type, evidence_label, evidence_options)
where mt.milestone_id = m.id
  and m.order_index = v.milestone_order
  and mt.order_index = v.order_index;
