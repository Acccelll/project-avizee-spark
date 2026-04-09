/**
 * Shared utilities for fiscal document ID normalisation.
 *
 * The database currently has two fields that may hold the link to a fiscal
 * document: `nota_fiscal_id` (older convention) and `documento_fiscal_id`
 * (newer convention).  Until the schema is unified, every consumer should
 * resolve the "effective" ID through this helper instead of scattering
 * manual OR/coalesce conditions throughout the codebase.
 */

export interface FiscalIdRecord {
  nota_fiscal_id?: string | null;
  documento_fiscal_id?: string | null;
}

/**
 * Returns the effective fiscal document ID for a record that may carry
 * either `nota_fiscal_id` or `documento_fiscal_id`.
 *
 * Resolution order: nota_fiscal_id → documento_fiscal_id → null.
 */
export function getEffectiveFiscalId(record: FiscalIdRecord): string | null {
  return record.nota_fiscal_id ?? record.documento_fiscal_id ?? null;
}

/**
 * Returns true when the given fiscal document ID matches the effective ID
 * in the record, covering both field variants.
 */
export function matchesFiscalId(record: FiscalIdRecord, id: string): boolean {
  return record.nota_fiscal_id === id || record.documento_fiscal_id === id;
}
