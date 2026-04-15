-- Preparação de fluxo transacional para operações sensíveis do módulo Financeiro.

create or replace function public.financeiro_processar_baixa_lote(
  p_selected_ids uuid[],
  p_tipo_baixa text,
  p_valor_pago_baixa numeric,
  p_total_baixa numeric,
  p_baixa_date date,
  p_forma_pagamento text,
  p_conta_bancaria_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_saldo numeric;
  v_valor_pago numeric;
  v_novo_saldo numeric;
  v_ratio numeric;
  v_status text;
begin
  if p_selected_ids is null or cardinality(p_selected_ids) = 0 then
    raise exception 'Nenhum lançamento selecionado para baixa em lote';
  end if;

  if p_forma_pagamento is null or p_conta_bancaria_id is null or p_baixa_date is null then
    raise exception 'Dados obrigatórios da baixa não informados';
  end if;

  if p_tipo_baixa not in ('total', 'parcial') then
    raise exception 'Tipo de baixa inválido: %', p_tipo_baixa;
  end if;

  if p_tipo_baixa = 'parcial' then
    if coalesce(p_total_baixa, 0) <= 0 or coalesce(p_valor_pago_baixa, 0) <= 0 then
      raise exception 'Baixa parcial inválida';
    end if;
    v_ratio := p_valor_pago_baixa / p_total_baixa;
  else
    v_ratio := 1;
  end if;

  foreach v_id in array p_selected_ids loop
    select coalesce(saldo_restante, valor)
      into v_saldo
      from financeiro_lancamentos
     where id = v_id
       and ativo = true
     for update;

    if v_saldo is null then
      raise exception 'Lançamento não encontrado ou inativo: %', v_id;
    end if;

    if p_tipo_baixa = 'total' then
      v_valor_pago := v_saldo;
      v_novo_saldo := 0;
      v_status := 'pago';
    else
      v_valor_pago := round(v_saldo * v_ratio, 2);
      v_novo_saldo := greatest(0, v_saldo - v_valor_pago);
      v_status := case when v_novo_saldo <= 0.01 then 'pago' else 'parcial' end;
    end if;

    update financeiro_lancamentos
       set status = v_status,
           data_pagamento = case when v_status = 'pago' then p_baixa_date else null end,
           valor_pago = v_valor_pago,
           tipo_baixa = p_tipo_baixa,
           forma_pagamento = p_forma_pagamento,
           conta_bancaria_id = p_conta_bancaria_id,
           saldo_restante = v_novo_saldo
     where id = v_id;

    if not found then
      raise exception 'Falha ao atualizar lançamento: %', v_id;
    end if;

    insert into financeiro_baixas (lancamento_id, valor_pago, data_baixa, forma_pagamento, conta_bancaria_id)
    values (v_id, v_valor_pago, p_baixa_date, p_forma_pagamento, p_conta_bancaria_id);
  end loop;
end;
$$;

create or replace function public.financeiro_processar_estorno(
  p_lancamento_id uuid,
  p_motivo_estorno text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update financeiro_lancamentos
     set status = 'aberto',
         data_pagamento = null,
         valor_pago = null,
         tipo_baixa = null,
         saldo_restante = null,
         motivo_estorno = p_motivo_estorno
   where id = p_lancamento_id;

  if not found then
    raise exception 'Lançamento não encontrado para estorno: %', p_lancamento_id;
  end if;

  delete from financeiro_baixas where lancamento_id = p_lancamento_id;

  update financeiro_lancamentos
     set ativo = false
   where documento_pai_id = p_lancamento_id;
end;
$$;
