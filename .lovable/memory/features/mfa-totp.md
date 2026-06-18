---
name: MFA TOTP
description: 2FA opcional via supabase.auth.mfa TOTP, com challenge em /mfa após signIn
type: feature
---
# MFA TOTP

- Hook: `src/pages/configuracoes/hooks/useMfa.ts` (enroll/verify/unenroll/listFactors).
- Gestão: `SegurancaSection.tsx` lista fatores e abre `MfaEnrollDialog` (QR + código).
- Challenge: `Login.tsx` consulta `getAuthenticatorAssuranceLevel()`; se `nextLevel==='aal2'`, redireciona para `/mfa` (rota pública `MfaChallenge`).
- Política: opcional para todos. Sem enforcement por papel.
