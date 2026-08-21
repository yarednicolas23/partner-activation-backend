-- Partner Activation Program (Kaspersky) — motor de hitos + evidencias
-- Ejecutar en el SQL editor de Supabase, después de schema.sql.
-- Mismo criterio que schema.sql: sin Supabase CLI migrations todavía.

create type public.evidence_type as enum ('text', 'file', 'none');
create type public.evidence_status as enum ('pending', 'approved', 'rejected');

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  order_index int not null unique,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.milestone_tasks (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones (id) on delete cascade,
  order_index int not null,
  title text not null,
  description text,
  evidence_type public.evidence_type not null default 'text',
  unique (milestone_id, order_index)
);

-- Una fila por (task, partner) — reenviar evidencia después de un rechazo
-- actualiza la misma fila (ver ON CONFLICT en el backend), no acumula historial.
create table public.task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.milestone_tasks (id) on delete cascade,
  partner_id uuid not null references public.profiles (id) on delete cascade,
  text_value text,
  file_path text,
  status public.evidence_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (task_id, partner_id)
);

alter table public.milestones enable row level security;
alter table public.milestone_tasks enable row level security;
alter table public.task_evidence enable row level security;

-- El backend decide qué milestones mostrar según desbloqueo (no RLS) — acá
-- solo se exige estar autenticado, igual criterio que jwt.strategy.ts sobre
-- no usar RLS como única defensa cuando el backend ya usa service role key.
create policy "milestones_select_authenticated"
  on public.milestones for select
  using (auth.role() = 'authenticated');

create policy "milestone_tasks_select_authenticated"
  on public.milestone_tasks for select
  using (auth.role() = 'authenticated');

create policy "task_evidence_select_own"
  on public.task_evidence for select
  using (auth.uid() = partner_id);

create policy "task_evidence_insert_own"
  on public.task_evidence for insert
  with check (auth.uid() = partner_id);

-- Seed: contenido STEP 1-5 del brief (Partner Activation Program VF.pdf),
-- traducido a pt-BR. Editable por SQL si Kaspersky ajusta el contenido final.

insert into public.milestones (order_index, title, description) values
  (1, 'Discover', 'Registro, onboarding e primeiros passos com a Kaspersky.'),
  (2, 'Enablement', 'Treinamentos, certificações e comunicação da parceria.'),
  (3, 'Engaging', 'Registro na KUDOS, quiz de parceria e geração de demanda.'),
  (4, 'Prospecting', 'Primeira oportunidade registrada e reunião conjunta.'),
  (5, 'Win/Celebration', 'Fechamento da primeira venda.');

insert into public.milestone_tasks (milestone_id, order_index, title, description, evidence_type)
select m.id, t.order_index, t.title, t.description, t.evidence_type::public.evidence_type
from public.milestones m
join (values
  -- Discover
  (1, 1, 'Registro no Partner Portal', 'Concluído automaticamente ao aceitar o convite.', 'none'),
  (1, 2, 'Participação no Webinar de Onboarding Comercial', 'Envie o certificado ou print de participação no webinar.', 'file'),
  (1, 3, 'Participação no Webinar de Onboarding Técnico', 'Envie o certificado ou print de participação no webinar.', 'file'),
  (1, 4, 'Download do Sales Kit', 'Confirmação do download.', 'none'),
  (1, 5, 'Inclusão do logo Kaspersky no site do parceiro', 'Envie um print da página com o logo incluído.', 'file'),
  -- Enablement
  (2, 1, 'Conclusão do treinamento online (Comercial)', 'Envie o certificado ou print de conclusão do treinamento.', 'file'),
  (2, 2, 'Conclusão do treinamento online (Técnico)', 'Envie o certificado ou print de conclusão do treinamento.', 'file'),
  (2, 3, 'Obtenção da Certificação Comercial', 'Envie o documento de certificação.', 'file'),
  (2, 4, 'Obtenção da Certificação Técnica', 'Envie o documento de certificação.', 'file'),
  (2, 5, 'Comunicação da parceria — Redes sociais', 'Envie um print da publicação.', 'file'),
  (2, 6, 'Comunicação da parceria — E-mail marketing', 'Envie o print ou o HTML usado no envio.', 'file'),
  (2, 7, 'Comunicação da parceria — Press release', 'Envie o arquivo ou print do press release publicado.', 'file'),
  (2, 8, 'Comunicação da parceria — Blog post', 'Envie um print do blog post publicado.', 'file'),
  (2, 9, 'Comunicação da parceria — Site do canal', 'Envie um print da página do site do canal.', 'file'),
  -- Engaging
  (3, 1, 'Cadastro de vendedores na plataforma KUDOS', 'Envie um print da lista de usuários cadastrados na KUDOS.', 'file'),
  (3, 2, 'Resposta ao quiz de parceria', 'Envie o print do resultado do quiz.', 'file'),
  (3, 3, 'Ação de geração de demanda', 'Webinar, evento, prospecção outbound, social selling, identificação de 5 clientes potenciais ou sales blitz interno — envie a evidência da ação escolhida.', 'file'),
  -- Prospecting
  (4, 1, 'Primeiro registro de oportunidade (Deal Registration)', 'Envie o documento ou print do deal registration aprovado.', 'file'),
  (4, 2, 'Reunião conjunta com a Kaspersky', 'Envie fotos e a lista de participantes.', 'file'),
  -- Win/Celebration
  (5, 1, 'Fechamento da primeira venda', 'Envie o documento ou print do pedido (order number).', 'file')
) as t(milestone_order, order_index, title, description, evidence_type)
  on t.milestone_order = m.order_index;
