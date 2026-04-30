UPDATE financeiro_lancamentos
SET ativo = true,
    observacoes = COALESCE(observacoes,'') || ' [Reativado em conciliação 2026-04-30: confirmado na planilha CR/CP]'
WHERE id IN (
  'fb3ab3d0-9313-4d5b-b96b-682bbaea2485',
  '992780fc-bbd7-4edf-8225-66ef196698c4',
  'b179ae9c-7c99-4099-a4d5-664312dcf131',
  'b8931172-ca97-4064-adce-0a956a7e54e7',
  'b8de116c-a05c-4f08-b1a0-2b9d38750ebb'
);