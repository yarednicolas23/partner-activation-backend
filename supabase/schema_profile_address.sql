-- Partner Activation Program (Kaspersky) — endereço de entrega do parceiro
-- Ejecutar en el SQL editor de Supabase, después de schema_rewards.sql.
--
-- Endereço no padrão brasileiro (Correios): CEP, logradouro, número,
-- complemento, bairro, cidade e UF. Fica no perfil para o parceiro
-- cadastrar uma vez; ao resgatar um reward físico/misto o endereço
-- confirmado é copiado (snapshot) para `reward_redemptions.shipping_address`
-- — assim, mudar o perfil depois não altera um envio já solicitado.
--
-- CEP e telefone guardam só dígitos; a máscara é responsabilidade da UI.

alter table public.profiles
  add column if not exists phone text
    check (phone is null or phone ~ '^\d{10,11}$'),
  add column if not exists address_cep text
    check (address_cep is null or address_cep ~ '^\d{8}$'),
  add column if not exists address_street text,
  add column if not exists address_number text,
  add column if not exists address_complement text,
  add column if not exists address_neighborhood text,
  add column if not exists address_city text,
  add column if not exists address_state char(2)
    check (address_state is null or address_state in (
      'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
      'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
    ));

alter table public.reward_redemptions
  add column if not exists shipping_address jsonb;
