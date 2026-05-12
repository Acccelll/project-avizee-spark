-- Vault hardening: restringir ler_secret_vault a service_role
REVOKE ALL ON FUNCTION public.ler_secret_vault(text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ler_secret_vault(text) TO service_role;

-- Defesa em profundidade: além do GRANT, exigir service_role na própria função
CREATE OR REPLACE FUNCTION public.ler_secret_vault(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Acesso restrito a serviços internos.' USING ERRCODE = '42501';
  END IF;

  SELECT decrypted_secret
    INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;

  RETURN v_secret;
END;
$function$;
