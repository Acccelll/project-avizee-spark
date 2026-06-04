create or replace function public.posicao_estoque_em_data(p_data timestamptz)
returns table(produto_id uuid, saldo numeric)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (m.produto_id)
    m.produto_id,
    m.saldo_atual as saldo
  from public.estoque_movimentos m
  where m.created_at <= p_data
    and m.empresa_id = current_empresa_id()
  order by m.produto_id, m.created_at desc, m.id desc;
$$;

grant execute on function public.posicao_estoque_em_data(timestamptz) to authenticated;