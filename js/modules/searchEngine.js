/**
 * searchEngine.js
 * Buscador global en tiempo real.
 * Evalúa coincidencias en ramas, sub-ramas y hojas (título + descripción + URL).
 */

const SearchEngine = (() => {
  /** @type {Array<{type, branchId, branchTitle, subbranchId?, subbranchTitle?, leafId?, description?, url?}>} */
  let _index = [];

  /**
   * Construye el índice de búsqueda a partir de los datos cargados.
   * Se llama cada vez que una rama nueva es cargada (lazy).
   * @param {object} indexData     Datos del index.json maestro
   * @param {Map<string,object>} branchesMap  Mapa de ramas ya cargadas
   */
  function buildIndex(indexData, branchesMap) {
    _index = [];

    // Indexar las entradas del mainBranchesIndex
    for (const entry of (indexData.mainBranchesIndex || [])) {
      _index.push({
        type: 'branch',
        branchId: entry.branchId,
        branchTitle: entry.title,
        order: entry.order,
      });

      const branch = branchesMap.get(entry.branchId);
      if (!branch) continue;

      // Indexar sub-ramas y hojas de cada rama cargada
      _indexSubbranches(branch.branchId, branch.branchTitle, branch.subbranches || []);

      // Hojas directas en la rama
      for (const leaf of (branch.leaves || [])) {
        _index.push({
          type: 'leaf',
          branchId: branch.branchId,
          branchTitle: branch.branchTitle,
          subbranchId: null,
          subbranchTitle: null,
          leafId: leaf.leafId,
          description: leaf.description || '',
          url: leaf.targetUrl || '',
          platformRef: leaf.platformIdRef,
        });
      }
    }
  }

  function _indexSubbranches(branchId, branchTitle, subbranches, parentPath = '') {
    for (const sub of subbranches) {
      const path = parentPath ? `${parentPath} › ${sub.subbranchTitle}` : sub.subbranchTitle;
      _index.push({
        type: 'subbranch',
        branchId,
        branchTitle,
        subbranchId: sub.subbranchId,
        subbranchTitle: sub.subbranchTitle,
        pathLabel: path,
        order: sub.order,
      });

      // Sub-sub-ramas recursivas
      _indexSubbranches(branchId, branchTitle, sub.subbranches || [], path);

      // Hojas
      for (const leaf of (sub.leaves || [])) {
        _index.push({
          type: 'leaf',
          branchId,
          branchTitle,
          subbranchId: sub.subbranchId,
          subbranchTitle: sub.subbranchTitle,
          pathLabel: path,
          leafId: leaf.leafId,
          description: leaf.description || '',
          url: leaf.targetUrl || '',
          platformRef: leaf.platformIdRef,
        });
      }
    }
  }

  /**
   * Ejecuta la búsqueda con una cadena de texto.
   * @param {string} query
   * @returns {Array} resultados ordenados por relevancia
   */
  function search(query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();

    return _index
      .filter(item => {
        const fields = [
          item.branchTitle,
          item.subbranchTitle,
          item.description,
          item.url,
          item.pathLabel,
        ].filter(Boolean).join(' ').toLowerCase();
        return fields.includes(q);
      })
      .slice(0, 20); // Máximo 20 resultados
  }

  /** Añade entradas de una rama recién cargada sin reconstruir todo el índice */
  function addBranch(branchData) {
    // Eliminar entradas previas de esta rama para evitar duplicados
    _index = _index.filter(e => e.branchId !== branchData.branchId);
    _indexSubbranches(branchData.branchId, branchData.branchTitle, branchData.subbranches || []);
    for (const leaf of (branchData.leaves || [])) {
      _index.push({
        type: 'leaf',
        branchId: branchData.branchId,
        branchTitle: branchData.branchTitle,
        subbranchId: null,
        subbranchTitle: null,
        leafId: leaf.leafId,
        description: leaf.description || '',
        url: leaf.targetUrl || '',
        platformRef: leaf.platformIdRef,
      });
    }
  }

  return { buildIndex, search, addBranch };
})();

export default SearchEngine;
