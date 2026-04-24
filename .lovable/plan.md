
**Refinar `OrcamentoPdfTemplate.tsx` para igualar visualmente o modelo de referência (image-27):**

1. **Header em 3 colunas com bordas internas verticais**
   - Coluna 1 (~38%): Logo AVIZEE grande (~110px de altura), centralizada com padding generoso
   - Coluna 2 (~40%): Nome empresa empilhado em bloco superior ("AviZee / Equipamentos / LTDA") e endereço/CNPJ no bloco inferior, separados por borda horizontal interna
   - Coluna 3 (~22%): 4 células empilhadas ("Orçamento", número em mono com underline, "Data", data formatada)

2. **Bloco Cliente em grid de 2 colunas** com line-height 2.0 e fontSize 11px, labels em bold preto e valores em peso normal. Pares organizados como no modelo: Cod.Cliente | Fantasia, Cliente (full), Endereço (full), Bairro/Cidade/UF/CEP, CNPJ/IE, Email (full), Fone/Celular/Contato

3. **Tabela de itens com bordas verticais no header laranja**, padding vertical do header subindo para 8px, fontSize 10px, mantendo mínimo de 10 linhas vazias

4. **Bloco de Totais reformulado para igualar a imagem**:
   - Headers permitem quebra natural ("(+)Imposto / S.T.") via lineHeight 1.2
   - Padding vertical 10-12px nas células de valores
   - Valores monetários em fontSize 11px bold mono
   - "Valor Total" (header e célula) em fontSize 13px bold branco sobre laranja
   - Linha info reorganizada em 4 colunas distintas com bordas: Quantidade | Peso | Pagamento | Prazo
   - "A PRAZO" exibido em bold abaixo do label Pagamento

5. **Tipografia geral subindo** para fontSize base 10.5-11px (mais respirável, próximo ao modelo)

6. **Mantido**: cor laranja `#C9743A`, formato A4 com padding 8mm/10mm, fonte Montserrat, bloco OBSERVAÇÕES no rodapé, geração via html2canvas+jsPDF em `OrcamentoForm.tsx` (sem alterações na lógica)

7. **Verificação pós-edição**: rodar `npx tsc --noEmit` para validar tipos. Pedir ao usuário para gerar um novo PDF de teste e comparar lado a lado com o modelo.
