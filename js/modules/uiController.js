/**
 * uiController.js
 * Gestión de modales, catálogo de plataformas e importación/exportación JSON.
 * Coordina la edición libre sin login y la pista de auditoría.
 */

import GitStorage  from './gitStorage.js';
import DataLoader  from './dataLoader.js';

const UIController = (() => {
  let _indexData   = null;
  let _branchesMap = new Map();
  let _onSave      = null;   // Callback global para refrescar vistas tras guardar

  // ── ID helpers ───────────────────────────────────────────

  function _uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`;
  }

  // ── Init ─────────────────────────────────────────────────

  function init(indexData, branchesMap, onSave) {
    _indexData   = indexData;
    _branchesMap = branchesMap;
    _onSave      = onSave;
    _updateAuditBadge();
  }

  // ── Auditoría ────────────────────────────────────────────

  function _updateAuditBadge() {
    const badge = document.getElementById('audit-badge');
    if (!badge || !_indexData) return;
    const a = _indexData.audit || {};
    const date = a.lastModified
      ? new Date(a.lastModified).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
      : '—';
    badge.innerHTML = `<strong>${a.modifiedBy || 'Anónimo'}</strong> · ${date}`;
    badge.title = a.changeDescription || '';
  }

  function _commitAudit(description, author) {
    if (!_indexData.audit) _indexData.audit = {};
    _indexData.audit.lastModified    = new Date().toISOString();
    _indexData.audit.modifiedBy      = author || 'Anónimo';
    _indexData.audit.changeDescription = description || 'Cambio sin descripción';
    _updateAuditBadge();
    GitStorage.saveIndex(_indexData);
  }

  // ── Modal Factory ────────────────────────────────────────

  function _createModal(title, bodyHTML, footerHTML, id = '', lgSize = false) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = id ? `modal-${id}` : '';

    overlay.innerHTML = `
      <div class="modal ${lgSize ? 'modal-lg' : ''}">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="modal-close" aria-label="Cerrar">×</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        <div class="modal-footer">${footerHTML}</div>
      </div>`;

    overlay.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(overlay); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    return overlay;
  }

  function closeModal(overlay) {
    overlay.classList.remove('open');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  }

  // ── Modal: Editar Rama ───────────────────────────────────

  function openEditBranchModal(branchId) {
    const indexEntry = (_indexData.mainBranchesIndex || []).find(e => e.branchId === branchId);
    const branchData = _branchesMap.get(branchId);
    if (!indexEntry || !branchData) return;

    const body = `
      <div class="form-group">
        <label class="form-label">Título de la Rama</label>
        <input class="form-input" id="edit-branch-title" value="${_esc(branchData.branchTitle)}">
      </div>
      <div class="form-group">
        <label class="form-label">Miniatura (URL o ruta)</label>
        <input class="form-input" id="edit-branch-thumb" value="${_esc(branchData.thumbnail || '')}">
        <span class="form-hint">Deja vacío para fondo negro automático.</span>
      </div>
      ${_authorField()}`;

    const footer = `
      <button class="btn-ghost" id="btn-cancel-edit-branch">Cancelar</button>
      <button class="btn-primary" id="btn-save-edit-branch">Guardar</button>`;

    const modal = _createModal('Editar Rama', body, footer, 'edit-branch');
    modal.querySelector('#btn-cancel-edit-branch').addEventListener('click', () => closeModal(modal));
    modal.querySelector('#btn-save-edit-branch').addEventListener('click', () => {
      const title  = modal.querySelector('#edit-branch-title').value.trim();
      const thumb  = modal.querySelector('#edit-branch-thumb').value.trim();
      const author = modal.querySelector('#audit-author-input').value.trim();

      if (!title) return;
      branchData.branchTitle  = title;
      branchData.thumbnail    = thumb || null;
      indexEntry.title        = title;

      GitStorage.saveBranch(branchId, branchData);
      _commitAudit(`Editada la rama: ${title}`, author);
      closeModal(modal);
      _onSave && _onSave();
    });
  }

  // ── Modal: Nueva Rama ────────────────────────────────────

  function openAddBranchModal() {
    const body = `
      <div class="form-group">
        <label class="form-label">ID de la Rama (sin espacios)</label>
        <input class="form-input" id="new-branch-id" placeholder="rama_03">
      </div>
      <div class="form-group">
        <label class="form-label">Título de la Rama</label>
        <input class="form-input" id="new-branch-title" placeholder="Mi nueva rama">
      </div>
      <div class="form-group">
        <label class="form-label">Miniatura (URL o ruta)</label>
        <input class="form-input" id="new-branch-thumb" placeholder="https://...">
      </div>
      ${_authorField()}`;

    const footer = `
      <button class="btn-ghost" id="btn-cancel-add-branch">Cancelar</button>
      <button class="btn-primary" id="btn-confirm-add-branch">Crear Rama</button>`;

    const modal = _createModal('Nueva Rama Principal', body, footer, 'add-branch');
    modal.querySelector('#btn-cancel-add-branch').addEventListener('click', () => closeModal(modal));
    modal.querySelector('#btn-confirm-add-branch').addEventListener('click', () => {
      const id     = modal.querySelector('#new-branch-id').value.trim().replace(/\s+/g,'_');
      const title  = modal.querySelector('#new-branch-title').value.trim();
      const thumb  = modal.querySelector('#new-branch-thumb').value.trim();
      const author = modal.querySelector('#audit-author-input').value.trim();

      if (!id || !title) {
        _showValidation(modal, 'error', 'El ID y el título son obligatorios.');
        return;
      }
      if ((_indexData.mainBranchesIndex || []).some(e => e.branchId === id)) {
        _showValidation(modal, 'error', `El ID "${id}" ya existe.`);
        return;
      }

      const maxOrder = Math.max(0, ...(_indexData.mainBranchesIndex || []).map(e => e.order));
      const entry = { branchId: id, order: maxOrder + 1, title, file: `data/branches/${id}.json` };
      _indexData.mainBranchesIndex.push(entry);

      const branchData = { branchId: id, branchTitle: title, thumbnail: thumb || null, subbranches: [], leaves: [] };
      _branchesMap.set(id, branchData);

      GitStorage.saveBranch(id, branchData);
      _commitAudit(`Nueva rama creada: ${title}`, author);
      closeModal(modal);
      _onSave && _onSave();
    });
  }

  // ── Modal: Editar Sub-rama ───────────────────────────────

  function openEditSubbranchModal(branchId, subbranchId) {
    const branch = _branchesMap.get(branchId);
    if (!branch) return;
    const sub = _findSubbranch(branch.subbranches, subbranchId);
    if (!sub) return;

    const body = `
      <div class="form-group">
        <label class="form-label">Título de la Sub-rama</label>
        <input class="form-input" id="edit-sub-title" value="${_esc(sub.subbranchTitle)}">
      </div>
      <div class="form-group">
        <label class="form-label">Miniatura (URL o ruta)</label>
        <input class="form-input" id="edit-sub-thumb" value="${_esc(sub.thumbnail || '')}">
      </div>
      ${_authorField()}`;

    const footer = `
      <button class="btn-ghost" id="btn-cancel-edit-sub">Cancelar</button>
      <button class="btn-primary" id="btn-save-edit-sub">Guardar</button>`;

    const modal = _createModal('Editar Sub-rama', body, footer, 'edit-sub');
    modal.querySelector('#btn-cancel-edit-sub').addEventListener('click', () => closeModal(modal));
    modal.querySelector('#btn-save-edit-sub').addEventListener('click', () => {
      const title  = modal.querySelector('#edit-sub-title').value.trim();
      const thumb  = modal.querySelector('#edit-sub-thumb').value.trim();
      const author = modal.querySelector('#audit-author-input').value.trim();
      if (!title) return;
      sub.subbranchTitle = title;
      sub.thumbnail = thumb || null;
      GitStorage.saveBranch(branchId, branch);
      _commitAudit(`Sub-rama editada: ${title}`, author);
      closeModal(modal);
      _onSave && _onSave();
    });
  }

  // ── Modal: Nueva Sub-rama ────────────────────────────────

  function openAddSubbranchModal(branchId) {
    const branch = _branchesMap.get(branchId);
    if (!branch) return;

    const body = `
      <div class="form-group">
        <label class="form-label">Título de la Sub-rama</label>
        <input class="form-input" id="new-sub-title" placeholder="Nuevo tema...">
      </div>
      ${_authorField()}`;

    const footer = `
      <button class="btn-ghost" id="btn-cancel-add-sub">Cancelar</button>
      <button class="btn-primary" id="btn-confirm-add-sub">Crear</button>`;

    const modal = _createModal('Nueva Sub-rama', body, footer, 'add-sub');
    modal.querySelector('#btn-cancel-add-sub').addEventListener('click', () => closeModal(modal));
    modal.querySelector('#btn-confirm-add-sub').addEventListener('click', () => {
      const title  = modal.querySelector('#new-sub-title').value.trim();
      const author = modal.querySelector('#audit-author-input').value.trim();
      if (!title) return;
      const maxOrder = Math.max(0, ...(branch.subbranches || []).map(s => s.order));
      branch.subbranches.push({
        subbranchId: _uid('sub'),
        order: maxOrder + 1,
        subbranchTitle: title,
        thumbnail: null,
        subbranches: [],
        leaves: [],
      });
      GitStorage.saveBranch(branchId, branch);
      _commitAudit(`Sub-rama añadida a ${branch.branchTitle}: ${title}`, author);
      closeModal(modal);
      _onSave && _onSave();
    });
  }

  // ── Modal: Nueva Hoja (Enlace) ───────────────────────────

  function openAddLeafModal(branchId, subbranchId) {
    const branch = _branchesMap.get(branchId);
    if (!branch) return;
    const sub = subbranchId ? _findSubbranch(branch.subbranches, subbranchId) : null;
    const catalog = (_indexData.platformCatalog || []);

    const platformPills = catalog.map(p => `
      <label class="platform-pill" data-pid="${_esc(p.platformId)}">
        <img src="${_esc(p.icon)}" alt="${_esc(p.name)}">
        <span>${_esc(p.name)}</span>
      </label>`).join('');

    const body = `
      <div class="form-group">
        <label class="form-label">Plataforma</label>
        <div class="platform-picker" id="platform-picker">${platformPills}</div>
        <input type="hidden" id="selected-platform" value="">
      </div>
      <div class="form-group">
        <label class="form-label">URL destino</label>
        <input class="form-input" id="leaf-url" placeholder="https://...">
      </div>
      <div class="form-group">
        <label class="form-label">Descripción (opcional)</label>
        <input class="form-input" id="leaf-desc" placeholder="Breve descripción...">
      </div>
      <div class="form-group">
        <label class="form-label">Miniatura personalizada (URL)</label>
        <input class="form-input" id="leaf-thumb" placeholder="https://... o dejar vacío">
        <span class="form-hint">Si se deja vacío se intentará extraer og:image automáticamente.</span>
      </div>
      ${_authorField()}`;

    const footer = `
      <button class="btn-ghost" id="btn-cancel-add-leaf">Cancelar</button>
      <button class="btn-primary" id="btn-confirm-add-leaf">Agregar Enlace</button>`;

    const modal = _createModal('Agregar Enlace (Hoja)', body, footer, 'add-leaf');

    // Selección de plataforma
    modal.querySelectorAll('.platform-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        modal.querySelectorAll('.platform-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        modal.querySelector('#selected-platform').value = pill.dataset.pid;
      });
    });

    modal.querySelector('#btn-cancel-add-leaf').addEventListener('click', () => closeModal(modal));
    modal.querySelector('#btn-confirm-add-leaf').addEventListener('click', async () => {
      const platformIdRef = modal.querySelector('#selected-platform').value;
      const url    = modal.querySelector('#leaf-url').value.trim();
      const desc   = modal.querySelector('#leaf-desc').value.trim();
      const thumb  = modal.querySelector('#leaf-thumb').value.trim();
      const author = modal.querySelector('#audit-author-input').value.trim();

      if (!platformIdRef || !url) {
        _showValidation(modal, 'error', 'Selecciona una plataforma e ingresa la URL.');
        return;
      }

      // Intentar extraer og:image si no se proporcionó miniatura
      let autoThumb = null;
      if (!thumb) {
        autoThumb = await DataLoader.fetchOpenGraphImage(url);
      }

      const leaf = {
        leafId: _uid('leaf'),
        platformIdRef,
        targetUrl: url,
        description: desc || '',
        customThumbnail: thumb || null,
        autoThumbnailUrl: autoThumb,
      };

      const target = sub ? sub.leaves : branch.leaves;
      target.push(leaf);

      GitStorage.saveBranch(branchId, branch);
      _commitAudit(`Enlace añadido: ${url}`, author);
      closeModal(modal);
      _onSave && _onSave();
    });
  }

  // ── Modal: Eliminar ──────────────────────────────────────

  function openDeleteConfirmModal(title, onConfirm) {
    const body = `<p style="color:var(--text-main)">¿Eliminar <strong>${_esc(title)}</strong>? Esta acción no se puede deshacer.</p>`;
    const footer = `
      <button class="btn-ghost" id="btn-cancel-del">Cancelar</button>
      <button class="btn-danger" id="btn-confirm-del">Eliminar</button>`;
    const modal = _createModal('Confirmar eliminación', body, footer, 'delete-confirm');
    modal.querySelector('#btn-cancel-del').addEventListener('click', () => closeModal(modal));
    modal.querySelector('#btn-confirm-del').addEventListener('click', () => {
      closeModal(modal);
      onConfirm();
    });
  }

  // ── Modal: Catálogo de Plataformas ───────────────────────

  function openCatalogModal() {
    const catalog = _indexData.platformCatalog || [];

    const list = catalog.map(p => `
      <div class="platform-list-item" data-pid="${_esc(p.platformId)}">
        <img src="${_esc(p.icon)}" alt="${_esc(p.name)}" onerror="this.style.opacity='0.3'">
        <span class="platform-name">${_esc(p.name)}</span>
        <span class="platform-id">${_esc(p.platformId)}</span>
        <button class="btn-icon btn-del-platform" data-pid="${_esc(p.platformId)}" title="Eliminar">✕</button>
      </div>`).join('');

    const body = `
      <div class="platform-list" id="platform-catalog-list">${list}</div>
      <hr style="border-color:var(--border-color);margin:12px 0">
      <div class="form-group">
        <label class="form-label">Agregar nueva plataforma</label>
        <input class="form-input" id="new-plat-id"   placeholder="plat_twitch (sin espacios)">
        <input class="form-input" id="new-plat-name" placeholder="Nombre" style="margin-top:6px">
        <input class="form-input" id="new-plat-icon" placeholder="assets/icons/twitch.svg" style="margin-top:6px">
        <button class="btn-primary" id="btn-add-platform" style="margin-top:10px;width:100%">+ Agregar Plataforma</button>
      </div>
      ${_authorField()}`;

    const footer = `<button class="btn-primary" id="btn-close-catalog">Cerrar</button>`;
    const modal = _createModal('Catálogo de Plataformas', body, footer, 'catalog', true);

    modal.querySelector('#btn-close-catalog').addEventListener('click', () => closeModal(modal));

    modal.querySelector('#btn-add-platform').addEventListener('click', () => {
      const id   = modal.querySelector('#new-plat-id').value.trim().replace(/\s+/g,'_');
      const name = modal.querySelector('#new-plat-name').value.trim();
      const icon = modal.querySelector('#new-plat-icon').value.trim();
      const author = modal.querySelector('#audit-author-input').value.trim();
      if (!id || !name) return;
      if (catalog.some(p => p.platformId === id)) {
        _showValidation(modal, 'error', `El ID "${id}" ya existe.`); return;
      }
      catalog.push({ platformId: id, name, icon });
      _commitAudit(`Plataforma añadida al catálogo: ${name}`, author);
      closeModal(modal);
      openCatalogModal();
    });

    modal.querySelectorAll('.btn-del-platform').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.pid;
        const plat = catalog.find(p => p.platformId === pid);
        if (!plat) return;
        openDeleteConfirmModal(plat.name, () => {
          _indexData.platformCatalog = catalog.filter(p => p.platformId !== pid);
          _commitAudit(`Plataforma eliminada del catálogo: ${plat.name}`, 'Sistema');
          closeModal(modal);
          openCatalogModal();
        });
      });
    });
  }

  // ── Modal: Importar JSON de Rama ─────────────────────────

  function openImportModal() {
    const body = `
      <div class="import-drop-zone" id="import-drop-zone">
        <span class="drop-icon">📂</span>
        Arrastra aquí un archivo .json de rama<br>
        <small>o haz clic para seleccionarlo</small>
        <input type="file" id="import-file-input" accept=".json" style="display:none">
      </div>
      <div id="import-validation"></div>
      ${_authorField()}`;

    const footer = `
      <button class="btn-ghost" id="btn-cancel-import">Cancelar</button>
      <button class="btn-primary" id="btn-confirm-import" disabled>Importar</button>`;

    const modal = _createModal('Importar Rama JSON', body, footer, 'import');

    let parsedBranch = null;

    const dropZone = modal.querySelector('#import-drop-zone');
    const fileInput = modal.querySelector('#import-file-input');
    const validationEl = modal.querySelector('#import-validation');
    const confirmBtn = modal.querySelector('#btn-confirm-import');

    function processFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          parsedBranch = JSON.parse(e.target.result);
          if (!parsedBranch.branchId || !parsedBranch.branchTitle) throw new Error('Estructura inválida');
          _showValidation(modal, 'success', `✓ Válido: "${parsedBranch.branchTitle}" (${parsedBranch.branchId})`);
          confirmBtn.removeAttribute('disabled');
        } catch {
          parsedBranch = null;
          _showValidation(modal, 'error', '✗ Archivo JSON inválido o estructura incorrecta.');
          confirmBtn.setAttribute('disabled', true);
        }
      };
      reader.readAsText(file);
    }

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) processFile(fileInput.files[0]); });

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-active'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-active');
      if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
    });

    modal.querySelector('#btn-cancel-import').addEventListener('click', () => closeModal(modal));
    confirmBtn.addEventListener('click', () => {
      if (!parsedBranch) return;
      const author = modal.querySelector('#audit-author-input').value.trim();
      const existing = (_indexData.mainBranchesIndex || []).find(e => e.branchId === parsedBranch.branchId);
      if (existing) {
        _branchesMap.set(parsedBranch.branchId, parsedBranch);
        GitStorage.saveBranch(parsedBranch.branchId, parsedBranch);
      } else {
        const maxOrder = Math.max(0, ...(_indexData.mainBranchesIndex || []).map(e => e.order));
        _indexData.mainBranchesIndex.push({
          branchId: parsedBranch.branchId,
          order: maxOrder + 1,
          title: parsedBranch.branchTitle,
          file: `data/branches/${parsedBranch.branchId}.json`,
        });
        _branchesMap.set(parsedBranch.branchId, parsedBranch);
        GitStorage.saveBranch(parsedBranch.branchId, parsedBranch);
      }
      _commitAudit(`Rama importada: ${parsedBranch.branchTitle}`, author);
      closeModal(modal);
      _onSave && _onSave();
    });
  }

  // ── Modal: Editar Hoja (Enlace) ──────────────────────────

  function openEditLeafModal(branchId, subbranchId, leafId) {
    const branch = _branchesMap.get(branchId);
    if (!branch) return;

    let leaf = null;
    if (subbranchId) {
      const sub = _findSubbranch(branch.subbranches || [], subbranchId);
      if (sub) leaf = (sub.leaves || []).find(l => l.leafId === leafId);
    } else {
      leaf = (branch.leaves || []).find(l => l.leafId === leafId);
    }
    if (!leaf) return;

    const catalog = (_indexData.platformCatalog || []);
    const platformPills = catalog.map(p => `
      <label class="platform-pill${leaf.platformIdRef === p.platformId ? ' selected' : ''}" data-pid="${_esc(p.platformId)}">
        <img src="${_esc(p.icon)}" alt="${_esc(p.name)}">
        <span>${_esc(p.name)}</span>
      </label>`).join('');

    const body = `
      <div class="form-group">
        <label class="form-label">Plataforma</label>
        <div class="platform-picker" id="platform-picker-edit">${platformPills}</div>
        <input type="hidden" id="edit-selected-platform" value="${_esc(leaf.platformIdRef || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">URL destino</label>
        <input class="form-input" id="edit-leaf-url" value="${_esc(leaf.targetUrl || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <input class="form-input" id="edit-leaf-desc" value="${_esc(leaf.description || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Miniatura personalizada (URL)</label>
        <input class="form-input" id="edit-leaf-thumb" value="${_esc(leaf.customThumbnail || '')}">
        <span class="form-hint">Vacío = extraer og:image automáticamente.</span>
      </div>
      ${_authorField()}`;

    const footer = `
      <button class="btn-ghost" id="btn-cancel-edit-leaf">Cancelar</button>
      <button class="btn-primary" id="btn-save-edit-leaf">Guardar</button>`;

    const modal = _createModal('Editar Enlace', body, footer, 'edit-leaf');

    modal.querySelectorAll('.platform-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        modal.querySelectorAll('.platform-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
        modal.querySelector('#edit-selected-platform').value = pill.dataset.pid;
      });
    });

    modal.querySelector('#btn-cancel-edit-leaf').addEventListener('click', () => closeModal(modal));
    modal.querySelector('#btn-save-edit-leaf').addEventListener('click', async () => {
      const platformIdRef = modal.querySelector('#edit-selected-platform').value;
      const url    = modal.querySelector('#edit-leaf-url').value.trim();
      const desc   = modal.querySelector('#edit-leaf-desc').value.trim();
      const thumb  = modal.querySelector('#edit-leaf-thumb').value.trim();
      const author = modal.querySelector('#audit-author-input').value.trim();

      if (!url) {
        _showValidation(modal, 'error', 'La URL es obligatoria.');
        return;
      }

      leaf.platformIdRef   = platformIdRef || leaf.platformIdRef;
      leaf.targetUrl       = url;
      leaf.description     = desc;
      leaf.customThumbnail = thumb || null;

      if (!thumb && !leaf.autoThumbnailUrl) {
        leaf.autoThumbnailUrl = await DataLoader.fetchOpenGraphImage(url);
      }

      GitStorage.saveBranch(branchId, branch);
      _commitAudit(`Enlace editado: ${url}`, author);
      closeModal(modal);
      _onSave && _onSave();
    });
  }

  // ── Helpers de UI ────────────────────────────────────────

  function _authorField() {
    return `
      <div class="audit-author-row">
        <span>✎ Autor:</span>
        <input id="audit-author-input" placeholder="Anónimo" autocomplete="off">
      </div>`;
  }

  function _showValidation(modal, type, message) {
    const existing = modal.querySelector('.validation-msg');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = `validation-msg ${type}`;
    el.textContent = message;
    modal.querySelector('.modal-body').insertBefore(el, modal.querySelector('.modal-body').firstChild);
  }

  function _findSubbranch(subbranches, id) {
    for (const sub of subbranches) {
      if (sub.subbranchId === id) return sub;
      const found = _findSubbranch(sub.subbranches || [], id);
      if (found) return found;
    }
    return null;
  }

  function _esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  return {
    init,
    openEditBranchModal,
    openAddBranchModal,
    openEditSubbranchModal,
    openAddSubbranchModal,
    openAddLeafModal,
    openEditLeafModal,
    openDeleteConfirmModal,
    openCatalogModal,
    openImportModal,
    closeModal,
  };
})();

export default UIController;
