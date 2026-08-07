/**
 * treeRenderer.js
 * Renderizado en Vista Cuadrícula / Tarjetas.
 * Genera las tarjetas Neo-Brutalistas para las ramas y sub-ramas.
 */

import DataLoader    from './dataLoader.js';
import DragOrderEngine from './dragOrderEngine.js';

const TreeRenderer = (() => {
  let _container   = null;   // #branches-grid
  let _indexData   = null;
  let _branchesMap = new Map();
  let _catalog     = [];
  let _onDataChange = null;  // Callback para persistir cambios

  // ── Init ─────────────────────────────────────────────────

  function init(containerEl, onDataChange) {
    _container    = containerEl;
    _onDataChange = onDataChange;
  }

  // ── Render Completo ──────────────────────────────────────

  function renderAll(indexData, branchesMap, catalog) {
    _indexData   = indexData;
    _branchesMap = branchesMap;
    _catalog     = catalog;

    if (!_container) return;
    _container.innerHTML = '';

    const branches = [...(indexData.mainBranchesIndex || [])]
      .sort((a, b) => a.order - b.order);

    branches.forEach(entry => {
      const branchData = branchesMap.get(entry.branchId);
      if (branchData) {
        _container.appendChild(_renderBranchCard(entry, branchData));
      } else {
        _container.appendChild(_renderBranchCardStub(entry));
      }
    });

    // Botón para agregar nueva rama
    _container.appendChild(_renderAddBranchCTA());

    // Activar drag & drop sobre las ramas principales
    _initBranchDrag();
  }

  // ── Tarjeta de Rama ──────────────────────────────────────

  function _renderBranchCard(entry, branchData) {
    const card = document.createElement('div');
    card.className = 'branch-card';
    card.dataset.id = entry.branchId;

    card.innerHTML = `
      ${_thumbnailHTML(branchData.thumbnail)}
      <div class="card-header">
        <span class="drag-handle" title="Arrastrar para reordenar">⠿</span>
        <span class="card-order-badge">${entry.order}</span>
        <div class="card-title-group">
          <div class="card-title">${_esc(branchData.branchTitle)}</div>
          <div class="card-id">${_esc(entry.branchId)}</div>
        </div>
        <div class="card-actions">
          <button class="btn-icon btn-edit-branch" data-id="${entry.branchId}" title="Editar rama">✎</button>
          <button class="btn-icon btn-export-branch" data-id="${entry.branchId}" title="Exportar JSON">⬇</button>
          <button class="btn-icon btn-delete-branch" data-id="${entry.branchId}" title="Eliminar rama">✕</button>
        </div>
      </div>
      <div class="card-body">
        ${_renderSubbranchList(entry.branchId, branchData.subbranches || [])}
      </div>
      <div class="card-footer">
        <button class="btn-add btn-add-subbranch" data-branch="${entry.branchId}">+ Sub-rama</button>
        <button class="btn-add btn-add-leaf-direct" data-branch="${entry.branchId}">+ Enlace directo</button>
      </div>
    `;

    return card;
  }

  function _renderBranchCardStub(entry) {
    const card = document.createElement('div');
    card.className = 'branch-card';
    card.dataset.id = entry.branchId;
    card.innerHTML = `
      <div class="card-header">
        <span class="drag-handle">⠿</span>
        <span class="card-order-badge">${entry.order}</span>
        <div class="card-title-group">
          <div class="card-title">${_esc(entry.title)}</div>
          <div class="card-id">${_esc(entry.branchId)}</div>
        </div>
      </div>
      <div class="loading-state"><span class="spinner"></span> Cargando...</div>
    `;
    return card;
  }

  // ── Lista de Sub-ramas ───────────────────────────────────

  function _renderSubbranchList(branchId, subbranches) {
    if (!subbranches.length) return '<div class="form-hint" style="padding:8px 0">Sin sub-ramas aún.</div>';
    const sorted = [...subbranches].sort((a,b) => a.order - b.order);
    return `<ul class="subbranch-list" data-branch="${_esc(branchId)}">
      ${sorted.map(sub => _renderSubbranch(branchId, sub)).join('')}
    </ul>`;
  }

  function _renderSubbranch(branchId, sub) {
    const leavesHtml = (sub.leaves || []).map(leaf => _renderLeafWithCtx(leaf, branchId, sub.subbranchId)).join('');
    return `
      <li class="subbranch-item" data-id="${_esc(sub.subbranchId)}" data-branch="${_esc(branchId)}">
        <div class="subbranch-header">
          <span class="drag-handle" style="font-size:13px">⠿</span>
          <span class="subbranch-order">${sub.order}.</span>
          <span class="subbranch-title">${_esc(sub.subbranchTitle)}</span>
          <div class="subbranch-actions">
            <button class="btn-icon btn-edit-sub" data-branch="${_esc(branchId)}" data-id="${_esc(sub.subbranchId)}" title="Editar">✎</button>
            <button class="btn-icon btn-add-leaf" data-branch="${_esc(branchId)}" data-id="${_esc(sub.subbranchId)}" title="Agregar enlace">+</button>
            <button class="btn-icon btn-delete-sub" data-branch="${_esc(branchId)}" data-id="${_esc(sub.subbranchId)}" title="Eliminar">✕</button>
          </div>
          <span class="subbranch-toggle">▼</span>
        </div>
        <div class="leaves-container" data-subbranch="${_esc(sub.subbranchId)}">
          ${leavesHtml}
        </div>
      </li>`;
  }

  // ── Hoja / Enlace ────────────────────────────────────────

  function _renderLeaf(leaf) {
    const platform = _catalog.find(p => p.platformId === leaf.platformIdRef);
    const thumb    = DataLoader.resolveThumbnail(leaf);
    const iconSrc  = platform ? platform.icon : '';
    return `
      <div class="leaf-item" data-id="${_esc(leaf.leafId || '')}">
        <div class="leaf-thumbnail" style="background:var(--thumbnail-fallback)">
          ${thumb ? `<img src="${_esc(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">` : ''}
        </div>
        ${iconSrc ? `<img class="leaf-platform-icon" src="${_esc(iconSrc)}" alt="${_esc(platform.name)}">` : ''}
        <div class="leaf-info">
          <span class="leaf-description">${_esc(leaf.description || '—')}</span>
          <a class="leaf-url" href="${_esc(leaf.targetUrl)}" target="_blank" rel="noopener">${_esc(leaf.targetUrl)}</a>
        </div>
        <div class="leaf-actions">
          <button class="btn-icon btn-edit-leaf" data-id="${_esc(leaf.leafId || '')}" title="Editar">✎</button>
          <button class="btn-icon btn-delete-leaf" data-id="${_esc(leaf.leafId || '')}" title="Eliminar">✕</button>
        </div>
      </div>`;
  }

  // ── Leaf render con contexto de rama/subrama ─────────────────
  // (versión que incluye data-branch y data-subbranch para el controlador)
  function _renderLeafWithCtx(leaf, branchId, subbranchId) {
    const platform = _catalog.find(p => p.platformId === leaf.platformIdRef);
    const thumb    = DataLoader.resolveThumbnail(leaf);
    const iconSrc  = platform ? platform.icon : '';
    const sbAttr   = subbranchId ? `data-subbranch="${_esc(subbranchId)}"` : '';
    return `
      <div class="leaf-item" data-id="${_esc(leaf.leafId || '')}">
        <div class="leaf-thumbnail" style="background:var(--thumbnail-fallback)">
          ${thumb ? `<img src="${_esc(thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">` : ''}
        </div>
        ${iconSrc ? `<img class="leaf-platform-icon" src="${_esc(iconSrc)}" alt="${_esc(platform.name)}">` : ''}
        <div class="leaf-info">
          <span class="leaf-description">${_esc(leaf.description || '—')}</span>
          <a class="leaf-url" href="${_esc(leaf.targetUrl)}" target="_blank" rel="noopener">${_esc(leaf.targetUrl)}</a>
        </div>
        <div class="leaf-actions">
          <button class="btn-icon btn-edit-leaf" data-branch="${_esc(branchId)}" ${sbAttr} data-id="${_esc(leaf.leafId || '')}" title="Editar">✎</button>
          <button class="btn-icon btn-delete-leaf" data-branch="${_esc(branchId)}" ${sbAttr} data-id="${_esc(leaf.leafId || '')}" title="Eliminar">✕</button>
        </div>
      </div>`;
  }

  // ── Thumbnail ────────────────────────────────────────────

  function _thumbnailHTML(src) {
    if (!src) return `
      <div class="card-thumbnail-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>`;
    return `<img class="card-thumbnail" src="${_esc(src)}" alt="" onerror="this.parentElement.innerHTML='<div class=card-thumbnail-placeholder></div>'">`;
  }

  // ── Add Branch CTA ───────────────────────────────────────

  function _renderAddBranchCTA() {
    const btn = document.createElement('div');
    btn.className = 'add-branch-card';
    btn.id = 'btn-add-branch';
    btn.innerHTML = `<span class="add-icon">⊕</span><span>Nueva Rama Principal</span>`;
    return btn;
  }

  // ── Sub-branch accordion toggle ──────────────────────────

  function bindSubbranchToggle(container) {
    container.addEventListener('click', (e) => {
      const header = e.target.closest('.subbranch-header');
      if (!header) return;
      // Ignore clicks on action buttons
      if (e.target.closest('button')) return;
      const item = header.closest('.subbranch-item');
      item.classList.toggle('open');
    });
  }

  // ── Drag & Drop para Sub-ramas ───────────────────────────

  function initSubbranchDrag(branchId, onReorder) {
    const list = _container.querySelector(`.subbranch-list[data-branch="${branchId}"]`);
    if (!list) return;
    DragOrderEngine.init(list, '.subbranch-item', (newOrder) => {
      onReorder(branchId, newOrder);
    });
  }

  function _initBranchDrag() {
    DragOrderEngine.init(_container, '.branch-card', (newOrder) => {
      if (!_onDataChange || !_indexData) return;
      _indexData.mainBranchesIndex = DragOrderEngine.applyOrder(
        _indexData.mainBranchesIndex, 'branchId', newOrder
      );
      // Actualizar badges visuales
      _container.querySelectorAll('.branch-card').forEach(card => {
        const entry = _indexData.mainBranchesIndex.find(e => e.branchId === card.dataset.id);
        if (entry) {
          const badge = card.querySelector('.card-order-badge');
          if (badge) badge.textContent = entry.order;
        }
      });
      _onDataChange('index', _indexData);
    });
  }

  // ── Helpers ──────────────────────────────────────────────

  function _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  return { init, renderAll, bindSubbranchToggle, initSubbranchDrag };
})();

export default TreeRenderer;
