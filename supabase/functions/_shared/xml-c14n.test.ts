/**
 * Testes do canonicalizeExclusive — fixtures focadas em NFe.
 * Rode com: deno test supabase/functions/_shared/xml-c14n.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { canonicalizeExclusive } from "./xml-c14n.ts";

Deno.test("ordena atributos por (namespace, localName)", () => {
  const xml = `<a z="1" a="2" m="3"/>`;
  const out = canonicalizeExclusive(xml);
  assertEquals(out, `<a a="2" m="3" z="1"></a>`);
});

Deno.test("self-closing → forma expandida", () => {
  const xml = `<a/>`;
  assertEquals(canonicalizeExclusive(xml), `<a></a>`);
});

Deno.test("escapa caracteres em texto", () => {
  const xml = `<a>1 &amp; 2 &lt; 3</a>`;
  assertEquals(canonicalizeExclusive(xml), `<a>1 &amp; 2 &lt; 3</a>`);
});

Deno.test("escapa atributos com aspas e caracteres especiais", () => {
  const xml = `<a v="x&amp;y &quot;z&quot;"/>`;
  assertEquals(canonicalizeExclusive(xml), `<a v="x&amp;y &quot;z&quot;"></a>`);
});

Deno.test("emite apenas namespaces visivelmente utilizados", () => {
  // ns 'b' não é usado por nenhum elemento/atributo no subtree → não emitido
  const xml = `<a xmlns="urn:x" xmlns:b="urn:b"><c>v</c></a>`;
  const out = canonicalizeExclusive(xml);
  assertEquals(out, `<a xmlns="urn:x"><c>v</c></a>`);
});

Deno.test("preserva ordem de elementos filhos e texto", () => {
  const xml = `<r><a>1</a><b>2</b><c>3</c></r>`;
  assertEquals(canonicalizeExclusive(xml), `<r><a>1</a><b>2</b><c>3</c></r>`);
});

Deno.test("infNFe simplificado mantém estrutura canônica", () => {
  const xml = `<infNFe Id="NFe35..." versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <ide><cUF>35</cUF></ide>
</infNFe>`;
  const out = canonicalizeExclusive(xml);
  // Espera ordem: xmlns, atributos por localName (Id < versao)
  assertEquals(
    out,
    `<infNFe xmlns="http://www.portalfiscal.inf.br/nfe" Id="NFe35..." versao="4.00">
  <ide><cUF>35</cUF></ide>
</infNFe>`,
  );
});

Deno.test("SignedInfo herdando ns do contexto pai", () => {
  // Quando passado como fragmento isolado, namespace herdado não é re-emitido se já existir
  const xml = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></SignedInfo>`;
  const out = canonicalizeExclusive(xml);
  assertEquals(
    out,
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod></SignedInfo>`,
  );
});