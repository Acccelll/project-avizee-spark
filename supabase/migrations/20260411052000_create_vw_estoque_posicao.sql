-- View: vw_estoque_posicao
-- Aggregates stock position per product and warehouse (armazem).
-- Falls back to the denormalized estoque_atual on produtos when no
-- armazem-level breakdown is available.

create or replace view vw_estoque_posicao as
select
  p.id                              as produto_id,
  p.nome                            as produto_nome,
  p.sku,
  p.codigo_interno,
  p.unidade_medida,
  p.estoque_minimo,
  p.preco_venda,
  p.ativo,
  -- Aggregate saldo_atual from the last movimento per product.
  -- If estoque_movimentos is empty for a product, fall back to p.estoque_atual.
  coalesce(
    (
      select m.saldo_atual
      from   estoque_movimentos m
      where  m.produto_id = p.id
      order  by m.created_at desc
      limit  1
    ),
    p.estoque_atual,
    0
  )                                 as estoque_atual,
  -- Remaining reserved quantity (reserva moves without a matching liberacao)
  coalesce(
    (
      select coalesce(sum(case when m2.tipo = 'reserva'           then  m2.quantidade
                              when m2.tipo = 'liberacao_reserva' then -m2.quantidade
                              else 0 end), 0)
      from   estoque_movimentos m2
      where  m2.produto_id = p.id
    ),
    0
  )                                 as estoque_reservado
from produtos p
where p.ativo = true;
