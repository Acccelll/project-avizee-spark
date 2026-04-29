---
name: Certificado digital A1 (upload seguro)
description: Upload de .pfx para bucket dbavizee/certificados/empresa.pfx; senha em Vault via salvar_secret_vault; metadados em app_configuracoes.certificado_digital; sefaz-proxy action assinar-e-enviar-vault lê de lá
type: feature
---
- Componente: `src/components/fiscal/CertificadoUploader.tsx` (admin-only via RLS implícita das RPCs).
- Serviço: `src/services/fiscal/certificado.service.ts`
  - `uploadCertificadoA1(file, senha)`: parse via edge function → upload Storage → `salvar_secret_vault('CERTIFICADO_PFX_SENHA', senha)` → upsert `app_configuracoes.certificado_digital` (sem senha, sem .pfx).
  - `removerCertificadoA1()` limpa Storage + Vault + config.
- RPCs (security definer, search_path=public, admin-only):
  `salvar_secret_vault(p_name, p_secret)`, `existe_secret_vault(p_name)`, `remover_secret_vault(p_name)`.
- Edge function `sefaz-proxy` action `assinar-e-enviar-vault` lê `dbavizee/certificados/empresa.pfx` e secret `CERTIFICADO_PFX_SENHA`. Cliente NÃO envia mais credenciais.
- Banner de validade: ≤7d destrutivo, 8–30d warning, >30d success.
