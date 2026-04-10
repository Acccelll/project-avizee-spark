/**
 * Validação e consulta de códigos NCM (Nomenclatura Comum do Mercosul).
 */

/** Tabela local com NCMs comuns para consulta rápida. */
const DESCRICOES_NCM: Record<string, string> = {
  "01012100": "Cavalos reprodutores de raça pura",
  "01051110": "Galos e galinhas da espécie Gallus domesticus",
  "02011000": "Carcaças e meias-carcaças de bovinos, frescas ou refrigeradas",
  "04011010": "Leite e creme de leite não concentrados",
  "07011000": "Batatas, frescas ou refrigeradas, para semente",
  "10011100": "Trigo duro para semeadura",
  "22021000": "Água, incluindo a água mineral e a água gaseificada",
  "30019000": "Outros produtos de origem animal para uso terapêutico",
  "39011010": "Polietileno de densidade inferior a 0,94",
  "40011000": "Látex de borracha natural",
  "44032000": "Madeira em bruto de coníferas",
  "61091000": "Camisetas de malha de algodão",
  "84713012": "Máquinas automáticas para processamento de dados, portáteis",
  "85171231": "Outros telefones para redes celulares",
  "87032110": "Veículos automóveis de cilindrada não superior a 1000 cm³",
};

/**
 * Verifica se o código NCM é válido.
 * Um NCM válido deve conter exatamente 8 dígitos numéricos (sem outros caracteres).
 */
export function validarNCM(codigo: string): boolean {
  if (!codigo) return false;
  return /^\d{8}$/.test(codigo.trim());
}

/**
 * Busca a descrição de um NCM.
 * Consulta a tabela local; retorna "NCM não encontrado" quando ausente.
 */
export async function buscarDescricaoNCM(codigo: string): Promise<string> {
  if (!validarNCM(codigo)) return "NCM inválido";
  return DESCRICOES_NCM[codigo.trim()] ?? "NCM não encontrado";
}
