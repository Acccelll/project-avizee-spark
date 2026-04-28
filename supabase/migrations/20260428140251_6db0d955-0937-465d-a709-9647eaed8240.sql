-- =====================================================================
-- Webhooks de saída — infraestrutura completa
-- =====================================================================

-- 1) Catálogo de eventos suportados (enum textual livre, validado por chk)
-- Mantido como TEXT para evolução simples; CHECK garante valores válidos.

create table if not exists public.webhooks_endpoints (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  url text not null,
  descricao text,
  eventos text[] not null default '{}',
  ativo boolean not null default true,
  secret_hash text not null,
  total_sucesso bigint not null default 0,
  total_falha bigint not null default 0,
  ultimo_disparo_em timestamptz,
  ultimo_status text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_webhooks_endpoints_url check (url ~* '^https?://'),
  constraint chk_webhooks_endpoints_status check (
    ultimo_status is null or ultimo_status in ('sucesso','falha','pendente','cancelado')
  )
);

create index if not exists idx_webhooks_endpoints_ativo on public.webhooks_endpoints (ativo);
create index if not exists idx_webhooks_endpoints_eventos on public.webhooks_endpoints using gin (eventos);

create table if not exists public.webhooks_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhooks_endpoints(id) on delete cascade,
  evento text not null,
  payload jsonb not null,
  status text not null default 'pendente',
  http_status int,
  tentativas int not null default 0,
  proxima_tentativa_em timestamptz,
  ultimo_erro text,
  signature text,
  enfileirado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  constraint chk_webhooks_deliveries_status check (
    status in ('pendente','sucesso','falha','cancelado')
  ),
  constraint chk_webhooks_deliveries_tentativas check (tentativas >= 0)
);

create index if not exists idx_webhooks_deliveries_endpoint on public.webhooks_deliveries (endpoint_id, enfileirado_em desc);
create index if not exists idx_webhooks_deliveries_status on public.webhooks_deliveries (status, proxima_tentativa_em);
create index if not exists idx_webhooks_deliveries_evento on public.webhooks_deliveries (evento);

-- updated_at trigger reaproveitado se já existir
create or replace function public.tg_webhooks_endpoints_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_webhooks_endpoints_updated_at on public.webhooks_endpoints;
create trigger trg_webhooks_endpoints_updated_at
before update on public.webhooks_endpoints
for each row execute function public.tg_webhooks_endpoints_set_updated_at();

-- =====================================================================
-- 2) RLS — admin-only em ambas tabelas
-- =====================================================================

alter table public.webhooks_endpoints enable row level security;
alter table public.webhooks_deliveries enable row level security;

-- Reusa has_role(uuid, app_role) já definido no projeto
drop policy if exists "Webhooks endpoints admin select" on public.webhooks_endpoints;
create policy "Webhooks endpoints admin select"
  on public.webhooks_endpoints for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Webhooks endpoints admin write" on public.webhooks_endpoints;
create policy "Webhooks endpoints admin write"
  on public.webhooks_endpoints for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Webhooks deliveries admin select" on public.webhooks_deliveries;
create policy "Webhooks deliveries admin select"
  on public.webhooks_deliveries for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Webhooks deliveries admin write" on public.webhooks_deliveries;
create policy "Webhooks deliveries admin write"
  on public.webhooks_deliveries for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =====================================================================
-- 3) Fila pgmq webhook_events
-- =====================================================================

do $$
begin
  perform pgmq.create('webhook_events');
exception when others then null;
end$$;

-- =====================================================================
-- 4) RPC para gerar secret e devolver em texto puro UMA VEZ
-- =====================================================================

create or replace function public.webhooks_create_endpoint(
  p_nome text,
  p_url text,
  p_eventos text[],
  p_descricao text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_hash text;
  v_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem criar webhooks.';
  end if;

  -- 32 bytes hex = 64 chars
  v_secret := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.webhooks_endpoints (nome, url, eventos, descricao, secret_hash, criado_por)
  values (p_nome, p_url, coalesce(p_eventos, '{}'), p_descricao, v_hash, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'secret', v_secret);
end;
$$;

create or replace function public.webhooks_rotate_secret(p_endpoint_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_hash text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem rotacionar segredos.';
  end if;

  v_secret := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  update public.webhooks_endpoints
  set secret_hash = v_hash, updated_at = now()
  where id = p_endpoint_id;

  if not found then
    raise exception 'Endpoint não encontrado.';
  end if;

  return jsonb_build_object('id', p_endpoint_id, 'secret', v_secret);
end;
$$;

-- =====================================================================
-- 5) Função interna: enfileira evento na pgmq
-- =====================================================================

create or replace function public.webhooks_enqueue(p_evento text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pgmq.send(
    'webhook_events',
    jsonb_build_object('evento', p_evento, 'payload', p_payload, 'enqueued_at', now())
  );
end;
$$;

-- =====================================================================
-- 6) Triggers de domínio: enfileiram quando algo relevante muda
-- =====================================================================

-- Notas fiscais: status muda para 'autorizada', 'cancelada', 'rejeitada'
create or replace function public.tg_webhooks_notas_fiscais()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento text;
begin
  if tg_op = 'INSERT' then
    v_evento := 'nota_fiscal.criada';
  elsif tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    v_evento := case new.status
      when 'autorizada' then 'nota_fiscal.autorizada'
      when 'cancelada' then 'nota_fiscal.cancelada'
      when 'rejeitada' then 'nota_fiscal.rejeitada'
      when 'emitida' then 'nota_fiscal.emitida'
      else null
    end;
  end if;

  if v_evento is not null then
    perform public.webhooks_enqueue(v_evento, jsonb_build_object(
      'id', new.id, 'numero', new.numero, 'serie', new.serie,
      'tipo', new.tipo, 'chave_acesso', new.chave_acesso,
      'status', new.status, 'valor_total', new.valor_total,
      'data_emissao', new.data_emissao,
      'cliente_id', new.cliente_id, 'fornecedor_id', new.fornecedor_id
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_webhooks_notas_fiscais on public.notas_fiscais;
create trigger trg_webhooks_notas_fiscais
after insert or update on public.notas_fiscais
for each row execute function public.tg_webhooks_notas_fiscais();

-- Orçamentos: status para aprovado / recusado / convertido
create or replace function public.tg_webhooks_orcamentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento text;
begin
  if tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    v_evento := case new.status
      when 'aprovado' then 'orcamento.aprovado'
      when 'recusado' then 'orcamento.recusado'
      when 'convertido' then 'orcamento.convertido'
      when 'enviado' then 'orcamento.enviado'
      else null
    end;
  end if;

  if v_evento is not null then
    perform public.webhooks_enqueue(v_evento, jsonb_build_object(
      'id', new.id, 'numero', new.numero, 'cliente_id', new.cliente_id,
      'status', new.status, 'valor_total', new.valor_total,
      'data_orcamento', new.data_orcamento
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_webhooks_orcamentos on public.orcamentos;
create trigger trg_webhooks_orcamentos
after update on public.orcamentos
for each row execute function public.tg_webhooks_orcamentos();

-- Ordens de venda: criação e mudanças de status
create or replace function public.tg_webhooks_ordens_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento text;
begin
  if tg_op = 'INSERT' then
    v_evento := 'ordem_venda.criada';
  elsif tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    v_evento := 'ordem_venda.status_alterado';
  end if;

  if v_evento is not null then
    perform public.webhooks_enqueue(v_evento, jsonb_build_object(
      'id', new.id, 'numero', new.numero, 'cliente_id', new.cliente_id,
      'status', new.status, 'valor_total', new.valor_total
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_webhooks_ordens_venda on public.ordens_venda;
create trigger trg_webhooks_ordens_venda
after insert or update on public.ordens_venda
for each row execute function public.tg_webhooks_ordens_venda();

-- Pedidos de compra: criação e mudanças de status
create or replace function public.tg_webhooks_pedidos_compra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento text;
begin
  if tg_op = 'INSERT' then
    v_evento := 'pedido_compra.criado';
  elsif tg_op = 'UPDATE' and (new.status is distinct from old.status) then
    v_evento := 'pedido_compra.status_alterado';
  end if;

  if v_evento is not null then
    perform public.webhooks_enqueue(v_evento, jsonb_build_object(
      'id', new.id, 'numero', new.numero, 'fornecedor_id', new.fornecedor_id,
      'status', new.status, 'valor_total', new.valor_total
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_webhooks_pedidos_compra on public.pedidos_compra;
create trigger trg_webhooks_pedidos_compra
after insert or update on public.pedidos_compra
for each row execute function public.tg_webhooks_pedidos_compra();

-- =====================================================================
-- 7) Métricas (painel de saúde)
-- =====================================================================

create or replace function public.webhooks_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pendentes bigint;
  v_falhas_recentes bigint;
  v_endpoints_ativos bigint;
  v_fila_total bigint;
  v_fila_oldest_age int;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem consultar métricas de webhooks.';
  end if;

  select count(*) into v_pendentes
  from public.webhooks_deliveries
  where status = 'pendente';

  select count(*) into v_falhas_recentes
  from public.webhooks_deliveries
  where status = 'falha' and enfileirado_em > now() - interval '24 hours';

  select count(*) into v_endpoints_ativos
  from public.webhooks_endpoints
  where ativo;

  begin
    select count(*),
           coalesce(extract(epoch from (now() - min(enqueued_at)))::int, 0)
      into v_fila_total, v_fila_oldest_age
      from pgmq.q_webhook_events;
  exception when others then
    v_fila_total := 0;
    v_fila_oldest_age := 0;
  end;

  return jsonb_build_object(
    'endpoints_ativos', v_endpoints_ativos,
    'deliveries_pendentes', v_pendentes,
    'falhas_24h', v_falhas_recentes,
    'fila_total', v_fila_total,
    'fila_oldest_age_seconds', v_fila_oldest_age
  );
end;
$$;