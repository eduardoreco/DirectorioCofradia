/**
 * gitStorage.js
 * Persiste cambios directamente en los archivos JSON modulares.
 *
 * Estrategia Jamstack/Serverless:
 *   - En producción (sin servidor): serializa a localStorage y ofrece
 *     descarga del JSON actualizado.
 *   - Con backend opcional (API REST simple): hace PUT al endpoint.
 *
 * El sistema NO requiere login en ningún caso.
 */

const GitStorage = (() => {
  const LS_PREFIX = 'yggdrasil_';

  // ── Helpers ─────────────────────────────────────────────

  function lsKey(id) { return `${LS_PREFIX}${id}`; }

  /** Lee del localStorage (shadow copy tras edición) */
  function readLocal(id) {
    const raw = localStorage.getItem(lsKey(id));
    return raw ? JSON.parse(raw) : null;
  }

  /** Escribe en localStorage */
  function writeLocal(id, data) {
    localStorage.setItem(lsKey(id), JSON.stringify(data, null, 2));
  }

  // ── Index ────────────────────────────────────────────────

  /** Persiste el index maestro */
  function saveIndex(indexData) {
    // Actualizar timestamp de auditoría si no se ha marcado ya
    writeLocal('__index__', indexData);
    triggerDownloadIfNeeded('index.json', indexData);
  }

  /** Persiste una rama individual */
  function saveBranch(branchId, branchData) {
    writeLocal(branchId, branchData);
    triggerDownloadIfNeeded(`data/branches/${branchId}.json`, branchData);
  }

  /**
   * Descarga opcional del JSON modificado para que el usuario
   * lo guarde manualmente en /data (Jamstack puro).
   */
  function triggerDownloadIfNeeded(filename, data) {
    // Solo dispara descarga si el usuario la confirmó explícitamente.
    // Se llama desde uiController cuando el usuario pulsa "Guardar y descargar".
  }

  /**
   * Descarga explícita del JSON — llamada desde uiController.
   */
  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Carga local con fallback a fetch:
   * 1. Si hay una copia en localStorage, la usa (edición no guardada en disco).
   * 2. Si no, carga el archivo original del servidor.
   */
  async function loadWithLocalFallback(id, fetchFn) {
    const local = readLocal(id);
    if (local) return local;
    return fetchFn();
  }

  /** Limpia la copia local de una rama (tras confirmar guardado) */
  function clearLocal(id) {
    localStorage.removeItem(lsKey(id));
  }

  /** Verifica si hay cambios locales no descargados */
  function hasUnsavedChanges(id) {
    return localStorage.getItem(lsKey(id)) !== null;
  }

  return { saveIndex, saveBranch, downloadJSON, loadWithLocalFallback, clearLocal, hasUnsavedChanges };
})();

export default GitStorage;
