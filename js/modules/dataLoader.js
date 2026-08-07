/**
 * dataLoader.js
 * Carga del index.json maestro y lazy loading de ramas.
 * Resolución automática de miniaturas Open Graph (3 capas).
 */

const DataLoader = (() => {
  const cache = new Map();

  /** Carga el archivo maestro index.json */
  async function loadIndex() {
    if (cache.has('__index__')) return cache.get('__index__');
    const res = await fetch('data/index.json');
    if (!res.ok) throw new Error(`Error al cargar index.json: ${res.status}`);
    const data = await res.json();
    cache.set('__index__', data);
    return data;
  }

  /**
   * Lazy Load: carga un archivo de rama individual sólo cuando se solicita.
   * @param {string} filePath  ruta relativa al JSON de la rama
   * @param {string} branchId  id clave para el caché
   */
  async function loadBranch(filePath, branchId) {
    if (cache.has(branchId)) return cache.get(branchId);
    const res = await fetch(filePath);
    if (!res.ok) throw new Error(`Error al cargar rama ${branchId}: ${res.status}`);
    const data = await res.json();
    cache.set(branchId, data);
    return data;
  }

  /** Invalida la caché de una rama para forzar recarga */
  function invalidate(branchId) {
    cache.delete(branchId);
  }

  /** Invalida todo el caché */
  function invalidateAll() {
    cache.clear();
  }

  /**
   * Resolución de miniatura en 3 capas:
   *   1. customThumbnail   → URL o dataURL aportada por el usuario
   *   2. autoThumbnailUrl  → og:image extraída previamente y guardada
   *   3. Fallback negro    → null (el CSS lo maneja con --thumbnail-fallback)
   */
  function resolveThumbnail(leaf) {
    if (leaf.customThumbnail) return leaf.customThumbnail;
    if (leaf.autoThumbnailUrl) return leaf.autoThumbnailUrl;
    return null; // CSS fallback: #000000
  }

  /**
   * Intenta extraer og:image de una URL destino a través de un proxy CORS público.
   * Sólo funciona en entornos con acceso a red. Silencia errores en Jamstack puro.
   * @param {string} targetUrl
   * @returns {Promise<string|null>}
   */
  async function fetchOpenGraphImage(targetUrl) {
    try {
      // Proxy gratuito CORS-Anywhere (requiere desbloqueo manual en prod)
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(proxy, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const json = await res.json();
      const html = json.contents || '';
      const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  return { loadIndex, loadBranch, invalidate, invalidateAll, resolveThumbnail, fetchOpenGraphImage };
})();

export default DataLoader;
