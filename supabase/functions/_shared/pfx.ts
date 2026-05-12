/**
 * Helpers compartilhados para extração de certificados A1 (PFX/PKCS#12).
 *
 * Centraliza lógica antes duplicada em `sefaz-proxy` e `sefaz-distdfe`:
 *  - `pfxToPem`: retorna PEM completo (leaf + intermediários) + chave privada + CNPJ.
 *  - `extrairChaveECertificado`: detecta o certificado folha e retorna o par
 *    `{ privateKey, cert }` para assinatura digital (xmldsig).
 *  - `parseCertificado`: extrai metadados (CNPJ, razão social, validade) para UI.
 *
 * Detecção do certificado folha: subject que NÃO é issuer de nenhum outro
 * certificado do bundle. Isso evita selecionar acidentalmente um intermediário
 * ICP-Brasil quando o PFX inclui a cadeia completa.
 */

// deno-lint-ignore no-explicit-any
import forge from "https://esm.sh/node-forge@1.3.1";

export interface CertificadoInfo {
  cnpj: string;
  razaoSocial: string;
  validadeInicio: string;
  validadeFim: string;
  diasRestantes: number;
}

function decodePfx(base64: string, senha: string) {
  const derBytes = forge.util.decode64(base64);
  const asn1 = forge.asn1.fromDer(derBytes);
  return forge.pkcs12.pkcs12FromAsn1(asn1, senha);
}

function getAllCerts(pfx: forge.pkcs12.Pkcs12Pfx): forge.pki.Certificate[] {
  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag });
  return (certBags[forge.pki.oids.certBag] ?? [])
    .map((b) => b?.cert)
    .filter((c): c is forge.pki.Certificate => !!c);
}

function getPrivateKey(pfx: forge.pkcs12.Pkcs12Pfx): forge.pki.rsa.PrivateKey {
  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("Chave privada não encontrada no PFX.");
  return keyBag.key as forge.pki.rsa.PrivateKey;
}

function selectLeaf(allCerts: forge.pki.Certificate[]): {
  leaf: forge.pki.Certificate;
  intermediates: forge.pki.Certificate[];
} {
  const subjectHash = (c: forge.pki.Certificate) =>
    c.subject.attributes.map((a) => `${a.shortName}=${a.value}`).join(",");
  const issuerHash = (c: forge.pki.Certificate) =>
    c.issuer.attributes.map((a) => `${a.shortName}=${a.value}`).join(",");
  const subjectsThatAreIssuers = new Set(allCerts.map((c) => issuerHash(c)));
  const leaf =
    allCerts.find((c) => !subjectsThatAreIssuers.has(subjectHash(c))) ?? allCerts[0];
  const intermediates = allCerts.filter((c) => c !== leaf);
  return { leaf, intermediates };
}

function extractCnpj(cert: forge.pki.Certificate): string {
  let cnpj = "";
  const sn = cert.subject.getField({ shortName: "serialNumber" });
  if (sn) cnpj = String(sn.value).replace(/\D/g, "");
  if (!cnpj || cnpj.length < 14) {
    const cn = cert.subject.getField("CN");
    if (cn) {
      const m = String(cn.value).match(/(\d{14})/);
      if (m) cnpj = m[1];
    }
  }
  return cnpj;
}

/**
 * Retorna PEM completo (leaf + intermediários) + chave privada + CNPJ.
 * Usado para autenticação mTLS contra a SEFAZ.
 */
export function pfxToPem(
  base64: string,
  senha: string,
): { certPem: string; keyPem: string; cnpj: string } {
  const pfx = decodePfx(base64, senha);
  const allCerts = getAllCerts(pfx);
  if (allCerts.length === 0) throw new Error("Certificado X.509 não encontrado no PFX.");
  const key = getPrivateKey(pfx);
  const { leaf, intermediates } = selectLeaf(allCerts);
  const certPem = [leaf, ...intermediates]
    .map((c) => forge.pki.certificateToPem(c))
    .join("\n");
  const keyPem = forge.pki.privateKeyToPem(key);
  return { certPem, keyPem, cnpj: extractCnpj(leaf) };
}

/**
 * Retorna o par `{ privateKey, cert }` para assinatura xmldsig (RSA-SHA1).
 * Sempre seleciona o certificado folha quando o PFX inclui a cadeia.
 */
export function extrairChaveECertificado(
  base64: string,
  senha: string,
): { privateKey: forge.pki.rsa.PrivateKey; cert: forge.pki.Certificate } {
  const pfx = decodePfx(base64, senha);
  const allCerts = getAllCerts(pfx);
  if (allCerts.length === 0) throw new Error("Certificado X.509 não encontrado no PFX.");
  const key = getPrivateKey(pfx);
  const { leaf } = selectLeaf(allCerts);
  return { privateKey: key, cert: leaf };
}

/**
 * Extrai metadados do certificado (CNPJ, razão social, validade).
 * Usado pelo painel de configuração para exibir info do A1 carregado.
 */
export function parseCertificado(
  base64: string,
  senha: string,
): CertificadoInfo {
  const pfx = decodePfx(base64, senha);
  const allCerts = getAllCerts(pfx);
  if (allCerts.length === 0) throw new Error("Certificado X.509 não encontrado no PFX.");
  const { leaf } = selectLeaf(allCerts);

  const cnpj = extractCnpj(leaf);

  const cnField = leaf.subject.getField("CN");
  let razaoSocial = cnField ? String(cnField.value) : "";
  razaoSocial = razaoSocial.replace(/:\d{11,14}/, "").trim();

  const validadeInicio = leaf.validity.notBefore.toISOString().split("T")[0];
  const validadeFim = leaf.validity.notAfter.toISOString().split("T")[0];
  const diasRestantes = Math.floor(
    (leaf.validity.notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return { cnpj, razaoSocial, validadeInicio, validadeFim, diasRestantes };
}