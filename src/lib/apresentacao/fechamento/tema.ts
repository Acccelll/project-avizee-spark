/** Identidade AviZee no deck (mesmas cores do orçamento e do site). */
import type { CorPapel } from './tipos';

export const COR = {
  vinho: '690500',
  vinho2: 'A0473D',
  vinho3: 'DCBCB3',
  terracota: 'B2592C',
  terracota2: 'D08A63',
  terracota3: 'ECC6AC',
  bege: 'DDD2C4',
  begeClaro: 'E9E0D4',
  creme: 'FFFAED',
  tinta: '1B1411',
  apagado: '8A7E73',
  linha: 'EFE9E0',
  regra: 'E4DCD2',
  bom: '4F7A46',
  ruim: 'B3261E',
  branco: 'FFFFFF',
  semVenda: 'ECE6DF',
} as const;

export const FONTE = 'Montserrat';

export function corPapel(p: CorPapel): string {
  switch (p) {
    case 'atual': return COR.vinho;
    case 'anterior': return COR.bege;
    case 'despesa': return COR.terracota;
    case 'bom': return COR.bom;
    case 'ruim': return COR.ruim;
    default: return COR.begeClaro;
  }
}

/** Escala do mapa por fatia do total. */
export function corFatia(fatia: number): string | null {
  if (fatia <= 0) return null;
  if (fatia >= 0.3) return COR.vinho;
  if (fatia >= 0.1) return COR.vinho2;
  if (fatia >= 0.03) return COR.terracota2;
  return COR.terracota3;
}

export const LEGENDA_MAPA: Array<[string, string]> = [
  [COR.vinho, '30% ou mais'],
  [COR.vinho2, '10 a 30%'],
  [COR.terracota2, '3 a 10%'],
  [COR.terracota3, 'até 3%'],
  [COR.semVenda, 'sem venda'],
];

/** Texto em branco sobre as cores escuras. */
export function textoSobre(fundo: string): string {
  return fundo === COR.vinho || fundo === COR.vinho2 || fundo === COR.ruim || fundo === COR.terracota ? COR.branco : COR.tinta;
}
