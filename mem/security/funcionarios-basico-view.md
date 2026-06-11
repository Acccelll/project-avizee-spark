---
name: funcionarios_basico view
description: SELECT em funcionarios é admin-only; roles operacionais leem nome/cargo via funcionarios_basico view
type: constraint
---

# Funcionários — Privacidade

`public.funcionarios` exige role admin para SELECT (policy `func_select` usa `has_role(auth.uid(),'admin')`). Campos sensíveis (`salario_base`, `cpf`, datas contratuais) restritos a RH/Folha.

Roles operacionais (financeiro, vendedor) devem consumir `public.funcionarios_basico` — view SECURITY DEFINER que expõe apenas `id, nome, cargo, departamento, ativo, created_at, updated_at`.

**Why:** A policy antiga permitia ao role `financeiro` ler salário e CPF inteiros — vazamento de PII e folha.

**How to apply:** ao escrever nova UI que só precisa do nome do funcionário (combobox em lançamento, etc.), usar `from("funcionarios_basico")` com cast helper (view não está nos types gerados).