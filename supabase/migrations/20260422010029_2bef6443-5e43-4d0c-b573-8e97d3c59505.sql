-- Atualiza status das notas históricas recém-importadas para 'importada'
UPDATE notas_fiscais 
SET status = 'importada' 
WHERE origem = 'importacao_historica' 
  AND status = 'pendente';