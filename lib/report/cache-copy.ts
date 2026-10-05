// Modulo puro (sin imports con alias) para poder probarlo con node --test.
/**
 * Copia de un informe reciente para la cache (CLAUDE.md s.4.8).
 *
 * La copia tiene que ser un informe COMPLETO. Antes solo llevaba
 * `raw = { cached_from, hibp }` y no copiaba `site_checks`, asi que el informe
 * copiado (que pasa a ser "el ultimo" de la cuenta) perdia la seccion de sitios
 * comprobados, la respuesta literal de cada IA y los datos con los que la
 * vigilancia mensual compara: el siguiente correo mensual daba por NUEVOS todos
 * los perfiles y sitios de datos, y el contador de retiradas bajaba.
 */
export interface CacheSource {
  request_id: string;
  raw: Record<string, unknown> | null;
  [column: string]: unknown;
}

export function copyForCache(source: CacheSource, requestId: string): Record<string, unknown> {
  const { request_id: from, raw, ...content } = source;
  // `diff` describe el cambio entre dos informes concretos de la vigilancia: no pertenece a la copia.
  const { diff: _diff, ...rest } = raw ?? {};
  void _diff;
  return { request_id: requestId, ...content, raw: { ...rest, cached_from: from } };
}
