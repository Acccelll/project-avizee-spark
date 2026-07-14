# Template Oficial — Novo Documento Fiscal

Este template descreve como implementar um novo documento fiscal (NFC-e, CT-e,
MDF-e, BP-e, NF3-e, NFS-e, ou qualquer futuro) como plugin da Fiscal Platform.
A NF-e (`src/modules/fiscal/nfe/`) é a implementação de referência.

## Estrutura recomendada

```
src/modules/fiscal/<codigo>/
├─ domain/            # Entidades, VOs, regras de negócio puras
├─ application/       # Casos de uso, contratos, eventos
├─ infrastructure/    # Adapters (XML/JSON builders, HTTP, persistência)
├─ __tests__/
└─ plugin.ts          # Plugin exportado via SDK
```

## Passos

1. **Defina o plugin** com `definePlugin` do SDK (`platform/sdk`).
2. **Declare capacidades** (`emissao`, `autorizacao`, `cancelamento`, ...).
3. **Registre layouts** (`defineLayout`) — sempre versionados.
4. **Registre serviços** (`defineServico`) — cada um com nome/versão/contrato.
5. **Registre validadores** (`defineValidador`) — separados por regra.
6. **Registre builders/parsers** (`defineBuilder`) — um por formato.
7. **Registre workflows** (`defineWorkflow`) — passos com `execute`/`compensate`.
8. **Registre eventos** com prefixo `fiscal.<codigo>.*`.
9. **Registre integrações** via `defineIntegracao` retornando `IntegracaoAdapter`.
10. **Publique o plugin** via `platform.use(plugin)`.

## Regras invioláveis

- Nenhuma dependência direta de outros documentos.
- Não importar do Core algo que não seja um contrato público.
- Toda regra tributária deve passar pelo Compliance Engine (Etapa 12).
- Comunicação SEFAZ obrigatoriamente pelo canal único (`sefaz-proxy`).
