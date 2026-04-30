/**
 * Parser de chave de acesso de NF-e/NFC-e a partir de texto livre, URL de
 * QR Code (NFC-e) ou conteúdo de código de barras CODE-128 do DANFE.
 *
 * Não realiza I/O nem consulta SEFAZ — apenas extrai e valida.
 */

import {
  validarChaveAcesso,
  extrairInformacoesChave,
  type ChaveAcessoInfo,
} from "./validadores/chaveAcesso.validator";

export type TipoDocumentoChave = "NF-e" | "NFC-e" | "outro";

/** modelo 55 = NF-e, 65 = NFC-e. */
export function tipoDocumentoPelaChave(chave: string): TipoDocumentoChave {
  const limpo = chave.replace(/\D/g, "");
  if (limpo.length !== 44) return "outro";
  const modelo = limpo.slice(20, 22);
  if (modelo === "55") return "NF-e";
  if (modelo === "65") return "NFC-e";
  return "outro";
}

/**
 * Extrai a chave de acesso (44 dígitos com DV válido) de um conteúdo arbitrário:
 *  - chave pura ou formatada com espaços/pontos;
 *  - URL de QR Code de NFC-e (parâmetro `p=` cuja primeira parte antes de `|`
 *    é a chave — ex.: SP `https://www.nfce.fazenda.sp.gov.br/qrcode?p=35260...|2|1|...`);
 *  - URL do portal NF-e com `chNFe=` ou `chave=`;
 *  - texto livre contendo a chave em meio a outros dígitos.
 *
 * Retorna a chave normalizada (44 dígitos) ou `null` se nada válido for encontrado.
 */
export function extrairChaveDeTextoOuUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  // 1) URL? Tenta extrair via parâmetros conhecidos antes de cair no regex genérico.
  const candidatos: string[] = [];

  const tentarUrl = (s: string): void => {
    try {
      const u = new URL(s);
      // QR Code NFC-e: parâmetro `p` no formato `<chave>|<versao>|<tpAmb>|<dhEmi>|...`
      const p = u.searchParams.get("p");
      if (p) candidatos.push(p.split("|")[0] ?? "");
      // Variações usadas em portais (chNFe, chave, chaveAcesso)
      for (const k of ["chNFe", "chave", "chaveAcesso", "chcte"]) {
        const v = u.searchParams.get(k);
        if (v) candidatos.push(v);
      }
    } catch {
      /* não é URL — segue */
    }
  };

  if (/^https?:\/\//i.test(raw)) tentarUrl(raw);
  // Texto pode conter URL embutida
  const urlMatch = raw.match(/https?:\/\/\S+/i);
  if (urlMatch && urlMatch[0] !== raw) tentarUrl(urlMatch[0]);

  // 2) O próprio input pode ser a chave (com ou sem separadores).
  candidatos.push(raw);

  // 3) Para cada candidato, isola sequências de 44+ dígitos consecutivos
  //    e testa MOD11. Devolve a primeira válida.
  for (const c of candidatos) {
    const apenasDigitos = c.replace(/\D/g, "");
    if (apenasDigitos.length === 44 && validarChaveAcesso(apenasDigitos)) {
      return apenasDigitos;
    }
    // Janela deslizante: pega cada substring de 44 dígitos contínuos no candidato.
    const seqs = c.match(/\d{44,}/g) ?? [];
    for (const seq of seqs) {
      for (let i = 0; i + 44 <= seq.length; i++) {
        const slice = seq.slice(i, i + 44);
        if (validarChaveAcesso(slice)) return slice;
      }
    }
  }

  return null;
}

export interface ChaveAcessoExtracao {
  chave: string;
  tipo: TipoDocumentoChave;
  info: ChaveAcessoInfo;
}

/**
 * Conveniência: extrai + classifica + decompõe em uma só chamada.
 * Retorna `null` se a chave não puder ser extraída/validada.
 */
export function lerChaveDeEntrada(input: string | null | undefined): ChaveAcessoExtracao | null {
  const chave = extrairChaveDeTextoOuUrl(input);
  if (!chave) return null;
  return {
    chave,
    tipo: tipoDocumentoPelaChave(chave),
    info: extrairInformacoesChave(chave),
  };
}