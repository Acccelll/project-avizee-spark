create or replace function public.webhooks_replay_delivery(p_delivery_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if not exists (select 1 from public.webhooks_deliveries where id = p_delivery_id) then
    raise exception 'delivery_not_found' using errcode = 'P0002';
  end if;

  update public.webhooks_deliveries
     set status = 'pendente',
         tentativas = 0,
         ultimo_erro = null,
         http_status = null,
         finalizado_em = null,
         proxima_tentativa_em = now()
   where id = p_delivery_id;

  return jsonb_build_object('id', p_delivery_id, 'status', 'pendente');
end;
$$;

revoke all on function public.webhooks_replay_delivery(uuid) from public;
grant execute on function public.webhooks_replay_delivery(uuid) to authenticated;

comment on function public.webhooks_replay_delivery(uuid) is
  'Admin-only. Marca delivery como pendente para reentrega imediata pelo dispatcher.';