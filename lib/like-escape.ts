// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Patron para comparar un texto EXACTO con `ilike` (sin distinguir mayusculas).
 * En LIKE/ILIKE, "_" vale por cualquier caracter y "%" por cualquier cadena: sin
 * escapar, "ana_garcia@gmail.com" tambien encuentra "ana.garcia@gmail.com", que
 * es el correo de otra persona. La barra invertida es el caracter de escape.
 */
export function ilikeExact(value: string): string {
  return value.replace(/[\\%_]/g, (c) => "\\" + c);
}
