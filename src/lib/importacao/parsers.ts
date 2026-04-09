/**
 * Parsers flexíveis para importação de dados.
 */

export interface ParseResult<T> {
  value: T | null;
  error?: string;
}

/**
 * Tenta converter qualquer valor para decimal de forma segura.
 */
export function parseDecimalFlexible(value: any): ParseResult<number> {
  if (value === null || value === undefined || value === '') return { value: 0 };
  if (typeof value === 'number') return { value };

  let str = String(value).trim();

  // Se contiver vírgula, assume formato BR (1.250,50)
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const parsed = parseFloat(str);

  if (isNaN(parsed)) {
    return { value: null, error: `Não foi possível converter "${value}" para decimal.` };
  }
  return { value: parsed };
}

/**
 * Tenta converter qualquer valor para inteiro.
 */
export function parseIntegerFlexible(value: any): ParseResult<number> {
  const result = parseDecimalFlexible(value);
  if (result.value === null) return result;
  return { value: Math.floor(result.value) };
}

/**
 * Tenta converter datas de diversos formatos (ISO, BR, Excel Serial).
 */
export function parseDateFlexible(value: any): ParseResult<string> {
  if (!value) return { value: null };
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return { value: null, error: 'Data inválida.' };
    return { value: value.toISOString().split('T')[0] };
  }

  const str = String(value).trim();

  // Tenta formato BR dd/mm/aaaa
  const brMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (brMatch) {
    const d = brMatch[1].padStart(2, '0');
    const m = brMatch[2].padStart(2, '0');
    let y = brMatch[3];
    if (y.length === 2) y = '20' + y;
    return { value: `${y}-${m}-${d}` };
  }

  // Tenta formato ISO aaaa-mm-dd
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { value: isoMatch[0] };
  }

  // Se for apenas número, pode ser serial do Excel (ex: 45382 para 31/03/2024)
  if (/^\d+$/.test(str)) {
    const serial = parseInt(str);
    // Base do Excel é 30/12/1899 (conforme padrão Lotus 1-2-3 bug)
    const excelBaseDate = new Date(1899, 11, 30);
    excelBaseDate.setDate(excelBaseDate.getDate() + serial);
    if (!isNaN(excelBaseDate.getTime())) {
      return { value: excelBaseDate.toISOString().split('T')[0] };
    }
  }

  return { value: null, error: `Formato de data inválido: "${value}"` };
}

/**
 * Tenta calcular quantidades em estoque aceitando expressões e unidades mistas.
 * Ex: "12", "12.5", "38DZ e 8un", "=41+(8/12)"
 */
export function parseQuantidadeEstoque(value: any): ParseResult<number> {
  if (value === null || value === undefined || value === '') return { value: 0 };
  if (typeof value === 'number') return { value };

  const str = String(value).trim();

  // Caso 1: Expressão matemática simples (começa com =)
  if (str.startsWith('=')) {
    try {
      // Expressão restrita para números e operadores básicos para evitar injeção
      const expression = str.substring(1).replace(',', '.');
      if (/^[\d+\-*/().\s]+$/.test(expression)) {
        // Usa o construtor Function como alternativa ligeiramente mais segura ao eval direto
        const calculated = new Function(`return ${expression}`)();
        if (typeof calculated === 'number' && !isNaN(calculated)) {
          return { value: calculated };
        }
      }
    } catch (e) {
      return { value: null, error: `Erro ao calcular expressão "${str}": ${e}` };
    }
  }

  // Caso 2: Unidades mistas (ex: 38DZ e 8un)
  // Procuramos por padrões como "10DZ", "5UN", "2CX"
  const mixedMatch = str.match(/(\d+[,.]?\d*)\s*(DZ|UN|CX|PC|KG|LT)/gi);
  if (mixedMatch && mixedMatch.length > 0) {
    let total = 0;
    for (const match of mixedMatch) {
      const parts = match.match(/(\d+[,.]?\d*)\s*(DZ|UN|CX|PC|KG|LT)/i);
      if (parts) {
        const val = parseFloat(parts[1].replace(',', '.'));
        const unit = parts[2].toUpperCase();

        if (unit === 'DZ') total += val * 12;
        else if (unit === 'CX') total += val * 6; // Assume padrão 6 se não souber? Perigoso.
        else total += val;
      }
    }
    return { value: total };
  }

  // Caso 3: Número simples
  const simple = parseDecimalFlexible(str);
  if (simple.value !== null) return simple;

  return { value: null, error: `Não foi possível interpretar a quantidade: "${value}"` };
}
