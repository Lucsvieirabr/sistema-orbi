/**
 * Parse/formatação dos campos de valor (NumericInput). Sem dependências para
 * poder ser testado direto no node (`tests/money-input.test.mjs`).
 */

/** Valor cru para edição, no formato brasileiro sem milhar: 1500.5 → "1500,50". */
export function toEditable(num: number, currency: boolean, integer: boolean): string {
  if (integer) return Math.floor(num).toString();
  return currency ? num.toFixed(2).replace(".", ",") : num.toString().replace(".", ",");
}

/**
 * "1.500,50" → 1500.5 | "1500,5" → 1500.5 | "12.34" → 12.34 (ponto único com
 * até 2 casas e sem vírgula = decimal digitado no teclado numérico) |
 * "5.000" → 5000 | "-1.500,50" → -1500.5.
 */
export function parseDecimalBR(str: string): number | null {
  const cleaned = str.replace(/R\$\s?/g, "").replace(/\s/g, "").trim();
  if (!cleaned) return null;
  const normalized =
    !cleaned.includes(",") && /^-?\d+\.\d{1,2}$/.test(cleaned)
      ? cleaned
      : cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? null : parsed;
}
