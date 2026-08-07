/**
 * app.js — Orquestador Yggdrasil (versión corregida)
 *
 * Correcciones aplicadas:
 *  - Spinner siempre removido (finally block + TreeRenderer limpia el contenedor).
 *  - _bindGridEvents() se registra UNA sola vez en boot() sobre #grid-view permanente;
 *    ya no se vuelve a llamar en cada _renderCurrentView() evitando listeners duplicados.
 *  - _bindHeaderControls() también se registra una sola vez.
 *  - Botón "+ Nueva Rama" añadido al header directamente, visible siempre.
 *  - _refresh() solo re-renderiza, nunca re-bindea eventos.
 *  - Manejo de error explícito con banner visible.
 */

import DataLoader      from './modules/dataLoader.js';
import GitStorage      from './modules/gitStorage.js';
import SearchEngine    from './modules/searchEngine.js';
import TreeRenderer    from './modules/treeRenderer.js';
import CanvasEngine    from './modules/canvasEngine.js';
import DragOrderEngine from './modules/dragOrderEngine.js';
import UIController    from './modules/uiController.js';

// ── Estado Global ────────────────────────────────────────────

let _indexData    = null;
let _branchesMap  = new Map();
let _currentView  = 'grid';
let _eventsBound  = false;   // Guard: eventos del header y grid se vinculan solo una vez

// ── Bootstrap ────────────────────────────────────────────────

async function boot() {
  try {
    // 1. Cargar index maestro
    _indexData = await GitStorage.loadWithLocalFallback('__index__', DataLoader.loadIndex);

    // 2. Actualizar branding con datos del JSON
    const orgName = (_indexData.organization || {}).name || 'Yggdrasil';
    const orgLogo = (_indexData.organization || {}).logo || '';
    const orgNameEl = document.getElementById('org-name');
    const orgLogoEl = document.getElementById('org-logo');
    if (orgNameEl) orgNameEl.textContent = orgName;
    if (orgLogoEl && orgLogo) orgLogoEl.src = orgLogo;
    document.title = `${orgName} · Yggdrasil`;

    // 3. Inicializar módulos que requieren elementos del DOM
    const gridEl       = document.getElementById('branches-grid');
    const canvasEl     = document.getElementById('tree-canvas');
    const nodesLayerEl = document.getElementById('canvas-nodes-layer');

    TreeRenderer.init(gridEl, _onDataChange);
    CanvasEngine.init(canvasEl, nodesLayerEl);
    UIController.init(_indexData, _branchesMap, _refresh);

    // 4. Vincular eventos (solo una vez)
    if (!_eventsBound) {
      _bindHeaderControls();
      _bindGridEvents();
      _eventsBound = true;
    }

    // 5. Cargar ramas en paralelo (lazy load)
    await _loadAllBranches();

    // 6. Render inicial — el spinner desaparece aquí
    _renderCurrentView();

  } catch (err) {
    console.error('[Yggdrasil] Error de arranque:', err);
    _removeSpinner();
    _showErrorBanner(
      `Error al cargar el directorio: ${err.message}. ` +
      'Asegúrate de servir la app desde un servidor local (no file://).'
    );
  }
}

// ── Carga de Ramas (Lazy Loading) ────────────────────────────

async function _loadAllBranches() {
  const entries = _indexData.mainBranchesIndex || [];
  await Promise.allSettled(
    entries.map(async entry => {
      try {
        const data = await GitStorage.loadWithLocalFallback(
          entry.branchId,
          () => DataLoader.loadBranch(entry.file, entry.branchId)
        );
        _branchesMap.set(entry.branchId, data);
        SearchEngine.addBranch(data);
      } catch (e) {
        console.warn(`[Yggdrasil] Rama ${entry.branchId} no pudo cargarse:`, e.message);
        // Crear objeto vacío de placeholder para que la UI igualmente muestre la tarjeta
        _branchesMap.set(entry.branchId, {
          branchId: entry.branchId,
          branchTitle: entry.title,
          thumbnail: null,
          subbranches: [],
          leaves: [],
          _loadError: true,
        });
      }
    })
  );
}

// ── Render de la Vista Activa ─────────────────────────────────

function _renderCurrentView() {
  _removeSpinner();

  const gridView   = document.getElementById('grid-view');
  const canvasView = document.getElementById('canvas-view');

  if (_currentView === 'grid') {
    gridView.classList.remove('hidden');
    canvasView.classList.add('hidden');
    TreeRenderer.renderAll(_indexData, _branchesMap, _indexData.platformCatalog || []);
    // Re-inicializar drag de sub-ramas en cada render (los nodos son nuevos)
    _initSubbranchDrags();
  } else {
    gridView.classList.add('hidden');
    canvasView.classList.remove('hidden');
    const branches = (_indexData.mainBranchesIndex || [])
      .sort((a, b) => a.order - b.order)
      .map(e => _branchesMap.get(e.branchId))
      .filter(Boolean);
    CanvasEngine.setData(
      (_indexData.organization || {}).name || 'Yggdrasil',
      branches,
      _indexData.platformCatalog || []
    );
  }
}

function _removeSpinner() {
  const spinner = document.getElementById('loading-indicator');
  if (spinner) spinner.remove();
}

// ── Drag de Sub-ramas (re-inicializa tras cada render) ────────

function _initSubbranchDrags() {
  (_indexData.mainBranchesIndex || []).forEach(entry => {
    TreeRenderer.initSubbranchDrag(entry.branchId, (bId, newOrder) => {
      const branch = _branchesMap.get(bId);
      if (!branch) return;
      branch.subbranches = DragOrderEngine.applyOrder(branch.subbranches, 'subbranchId', newOrder);
      _onDataChange(bId, branch);
    });
  });
}

// ── Eventos del Header (se registran UNA sola vez) ────────────

function _bindHeaderControls() {
  // Toggle de vista Grid ↔ Canvas
  document.getElementById('btn-view-grid')?.addEventListener('click', () => _setView('grid'));
  document.getElementById('btn-view-canvas')?.addEventListener('click', () => _setView('canvas'));

  // Botón Nueva Rama (en header)
  document.getElementById('btn-add-branch-header')?.addEventListener('click', () => {
    UIController.openAddBranchModal();
  });

  // Catálogo de plataformas
  document.getElementById('btn-open-catalog')?.addEventListener('click', () => {
    UIController.openCatalogModal();
  });

  // Importar JSON de rama
  document.getElementById('btn-import-branch')?.addEventListener('click', () => {
    UIController.openImportModal();
  });

  // Buscador en tiempo real
  const searchInput   = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');

  searchInput?.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (q.length < 2) { searchResults.classList.remove('visible'); return; }
    _renderSearchResults(SearchEngine.search(q), searchResults);
  });

  searchInput?.addEventListener('blur', () => {
    setTimeout(() => searchResults.classList.remove('visible'), 200);
  });

  // Canvas: guía secuencial
  document.getElementById('sequence-toggle')?.addEventListener('change', e => {
    CanvasEngine.setShowSequence(e.target.checked);
  });

  // Canvas: restablecer vista
  document.getElementById('btn-canvas-reset')?.addEventListener('click', () => {
    CanvasEngine.resetView();
  });
}

function _setView(view) {
  _currentView = view;
  document.getElementById('btn-view-grid')?.classList.toggle('active', view === 'grid');
  document.getElementById('btn-view-canvas')?.classList.toggle('active', view === 'canvas');
  _renderCurrentView();
}

// ── Eventos de la Grid (delegación permanente, UNA sola vez) ──

function _bindGridEvents() {
  const gridView = document.getElementById('grid-view');
  if (!gridView) return;

  // Un único listener de delegación sobre #grid-view (elemento permanente del DOM)
  gridView.addEventListener('click', e => {
    // ── Accordion de sub-ramas ──────────────────────────
    const subHeader = e.target.closest('.subbranch-header');
    if (subHeader && !e.target.closest('button')) {
      subHeader.closest('.subbranch-item')?.classList.toggle('open');
      return;
    }

    // ── Botones de acción ───────────────────────────────
    const btn = e.target.closest('button, [data-action]');
    if (!btn) {
      // Clic en tarjeta CTA "Nueva Rama"
      const cta = e.target.closest('.add-branch-card');
      if (cta) { UIController.openAddBranchModal(); }
      return;
    }

    const branchId = btn.dataset.branch || btn.dataset.id;
    const subId    = btn.dataset.id;

    // Nueva Rama (CTA dentro del grid, como botón)
    if (btn.classList.contains('add-branch-card') || btn.id === 'btn-add-branch') {
      UIController.openAddBranchModal();
      return;
    }

    // Editar rama
    if (btn.classList.contains('btn-edit-branch')) {
      UIController.openEditBranchModal(btn.dataset.id);
      return;
    }

    // Exportar JSON de rama
    if (btn.classList.contains('btn-export-branch')) {
      const bd = _branchesMap.get(btn.dataset.id);
      if (bd) GitStorage.downloadJSON(`${btn.dataset.id}.json`, bd);
      return;
    }

    // Eliminar rama
    if (btn.classList.contains('btn-delete-branch')) {
      const bid   = btn.dataset.id;
      const entry = (_indexData.mainBranchesIndex || []).find(e => e.branchId === bid);
      UIController.openDeleteConfirmModal(entry?.title || bid, () => {
        _indexData.mainBranchesIndex = (_indexData.mainBranchesIndex || []).filter(e => e.branchId !== bid);
        _branchesMap.delete(bid);
        GitStorage.saveIndex(_indexData);
        _refresh();
      });
      return;
    }

    // Agregar sub-rama
    if (btn.classList.contains('btn-add-subbranch')) {
      UIController.openAddSubbranchModal(btn.dataset.branch);
      return;
    }

    // Agregar enlace directo a rama
    if (btn.classList.contains('btn-add-leaf-direct')) {
      UIController.openAddLeafModal(btn.dataset.branch, null);
      return;
    }

    // Editar sub-rama
    if (btn.classList.contains('btn-edit-sub')) {
      UIController.openEditSubbranchModal(btn.dataset.branch, btn.dataset.id);
      return;
    }

    // Agregar hoja/enlace a sub-rama
    if (btn.classList.contains('btn-add-leaf')) {
      UIController.openAddLeafModal(btn.dataset.branch, btn.dataset.id);
      return;
    }

    // Eliminar sub-rama
    if (btn.classList.contains('btn-delete-sub')) {
      const branch = _branchesMap.get(btn.dataset.branch);
      if (!branch) return;
      const sub = (branch.subbranches || []).find(s => s.subbranchId === btn.dataset.id);
      UIController.openDeleteConfirmModal(sub?.subbranchTitle || btn.dataset.id, () => {
        branch.subbranches = (branch.subbranches || []).filter(s => s.subbranchId !== btn.dataset.id);
        GitStorage.saveBranch(btn.dataset.branch, branch);
        _refresh();
      });
      return;
    }

    // Eliminar hoja
    if (btn.classList.contains('btn-delete-leaf')) {
      _deleteLeafFromAny(btn.dataset.id);
      return;
    }

    // Editar hoja
    if (btn.classList.contains('btn-edit-leaf')) {
      UIController.openEditLeafModal(btn.dataset.branch, btn.dataset.subbranch, btn.dataset.id);
      return;
    }
  });
}

// ── Buscador ─────────────────────────────────────────────────

function _renderSearchResults(results, container) {
  if (!results.length) { container.classList.remove('visible'); return; }
  container.classList.add('visible');
  container.innerHTML = results.map(r => {
    const label = r.type === 'leaf'
      ? `<span class="result-match">${_esc(r.url)}</span>` : '';
    return `<div class="search-result-item"
        data-branch="${_esc(r.branchId)}"
        data-sub="${_esc(r.subbranchId || '')}">
      <span class="result-title">${_esc(r.subbranchTitle || r.branchTitle || r.description || '')}</span>
      <span class="result-path">${_esc(r.pathLabel || r.branchTitle || '')}</span>
      ${label}
    </div>`;
  }).join('');

  container.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      container.classList.remove('visible');
      if (_currentView === 'grid' && item.dataset.branch) {
        document.querySelector(`.branch-card[data-id="${item.dataset.branch}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

// ── Eliminar Hoja desde cualquier nivel ───────────────────────

function _deleteLeafFromAny(leafId) {
  for (const [branchId, branch] of _branchesMap) {
    const idx = (branch.leaves || []).findIndex(l => l.leafId === leafId);
    if (idx > -1) {
      UIController.openDeleteConfirmModal(branch.leaves[idx].description || 'Enlace', () => {
        branch.leaves.splice(idx, 1);
        GitStorage.saveBranch(branchId, branch);
        _refresh();
      });
      return;
    }
    for (const sub of (branch.subbranches || [])) {
      const si = (sub.leaves || []).findIndex(l => l.leafId === leafId);
      if (si > -1) {
        UIController.openDeleteConfirmModal(sub.leaves[si].description || 'Enlace', () => {
          sub.leaves.splice(si, 1);
          GitStorage.saveBranch(branchId, branch);
          _refresh();
        });
        return;
      }
    }
  }
}

// ── Callback de persistencia de datos ────────────────────────

function _onDataChange(id, data) {
  if (id === 'index') {
    GitStorage.saveIndex(data);
  } else {
    GitStorage.saveBranch(id, data);
  }
}

// ── Refresco de vistas (sin re-bindear eventos) ───────────────

function _refresh() {
  // Re-sincronizar el estado de UIController con los datos actuales
  UIController.init(_indexData, _branchesMap, _refresh);
  _renderCurrentView();
}

// ── Banner de error ───────────────────────────────────────────

function _showErrorBanner(msg) {
  const banner = document.createElement('div');
  banner.style.cssText = [
    'position:fixed', 'bottom:20px', 'left:50%', 'transform:translateX(-50%)',
    'background:#DC2626', 'color:#fff', 'padding:14px 22px', 'border-radius:8px',
    'font-size:13px', 'z-index:9999', 'max-width:480px', 'text-align:center',
    'line-height:1.5', 'box-shadow:0 4px 20px rgba(0,0,0,.5)',
  ].join(';');
  banner.textContent = msg;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 10000);
}

function _esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Arranque ─────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', boot);
