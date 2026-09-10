/**
 * Nombre parcialmente tapado para la imagen compartible (CLAUDE.md s.4.4):
 * "Alejandro Silvestre Fuentes" -> "Alejandro S. F."
 * Se mantiene el nombre de pila (la persona quiere que se sepa que es suyo)
 * y se reducen los apellidos a iniciales.
 */
export function maskName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  const [first, ...rest] = parts;
  return [first, ...rest.map((p) => `${p[0].toUpperCase()}.`)].join(" ");
}
