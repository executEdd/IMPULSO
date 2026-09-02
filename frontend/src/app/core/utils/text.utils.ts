/**
 * Normaliza texto eliminando acentos/diacríticos y convirtiendo a minúsculas.
 * Permite búsquedas flexibles: "matematicas" coincidirá con "Matemáticas".
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
