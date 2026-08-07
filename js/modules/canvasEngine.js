/**
 * canvasEngine.js
 * Renderizado del árbol en Canvas HTML5.
 * Nodos HTML superpuestos sobre canvas SVG con conectores vectoriales.
 * Soporta pan/zoom y guía secuencial entre sub-ramas.
 */

const CanvasEngine = (() => {
  let _canvas = null;
  let _ctx    = null;
  let _nodesLayer = null;
  let _data   = null;         // Estructura completa del árbol
  let _catalog = [];          // platformCatalog del index

  // ── Estado del lienzo ───────────────────────────────────
  let _transform = { x: 0, y: 0, scale: 1 };
  let _isPanning = false;
  let _panStart  = { x: 0, y: 0 };

  // ── Posiciones calculadas de nodos ──────────────────────
  let _nodePositions = new Map();   // id → {x, y, el}

  // ── Config de layout ────────────────────────────────────
  const LAYOUT = {
    rootX: 60, rootY: 0,
    branchOffsetX: 220,
    subbranchOffsetX: 200,
    leafOffsetX: 180,
    verticalGap: 90,
    nodeW: 180,
    nodeH: 64,
  };

  // ── Opciones ────────────────────────────────────────────
  let _showSequence = true;

  // ── Init ─────────────────────────────────────────────────

  function init(canvasEl, nodesLayerEl) {
    _canvas     = canvasEl;
    _ctx        = canvasEl.getContext('2d');
    _nodesLayer = nodesLayerEl;
    _resizeCanvas();

    window.addEventListener('resize', _resizeCanvas);

    // Pan con mouse
    canvasEl.addEventListener('mousedown', _onPanStart);
    window.addEventListener('mousemove',  _onPanMove);
    window.addEventListener('mouseup',    _onPanEnd);

    // Zoom con rueda
    canvasEl.addEventListener('wheel', _onWheel, { passive: false });
  }

  function _resizeCanvas() {
    if (!_canvas) return;
    const rect = _canvas.parentElement.getBoundingClientRect();
    _canvas.width  = rect.width;
    _canvas.height = rect.height;
    render();
  }

  // ── Render principal ────────────────────────────────────

  function render() {
    if (!_canvas || !_ctx) return;
    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    if (!_data) return;

    // Calcula posiciones
    _nodePositions.clear();
    _nodesLayer.innerHTML = '';
    let currentY = 80;
    currentY = _layoutTree(_data, currentY);

    // Dibuja conectores
    _drawConnectors();

    // Dibuja guía secuencial
    if (_showSequence) _drawSequenceGuide();
  }

  // ── Cálculo de layout (árbol vertical centrado) ──────────

  function _layoutTree(data, startY) {
    let y = startY;

    // Nodo raíz (organización)
    const rootId = '__root__';
    const rootX  = LAYOUT.rootX;
    const rootEl = _createNode('root', data.orgName || 'Yggdrasil', rootId, rootX, y);
    _nodePositions.set(rootId, { x: rootX, y, el: rootEl });
    y += LAYOUT.verticalGap * 1.5;

    // Ramas principales
    const branches = data.branches || [];
    branches.forEach((branch) => {
      const bx = LAYOUT.rootX + LAYOUT.branchOffsetX;
      const el = _createNode('branch', branch.branchTitle, branch.branchId, bx, y);
      _nodePositions.set(branch.branchId, { x: bx, y, el });

      const subbranches = [...(branch.subbranches || [])].sort((a,b) => a.order - b.order);
      subbranches.forEach((sub) => {
        y += LAYOUT.verticalGap;
        const sx = bx + LAYOUT.subbranchOffsetX;
        const se = _createNode('subbranch', sub.subbranchTitle, sub.subbranchId, sx, y);
        _nodePositions.set(sub.subbranchId, { x: sx, y, el: se });

        const leaves = [...(sub.leaves || [])];
        leaves.forEach((leaf) => {
          y += LAYOUT.verticalGap * 0.85;
          const lx = sx + LAYOUT.leafOffsetX;
          const le = _createNode('leaf', leaf.description || leaf.targetUrl, leaf.leafId, lx, y);
          _nodePositions.set(leaf.leafId, { x: lx, y, el: le });
        });

        if (leaves.length) y += LAYOUT.verticalGap * 0.3;
      });

      y += LAYOUT.verticalGap;
    });

    return y;
  }

  // ── Crear nodo HTML ──────────────────────────────────────

  function _createNode(type, title, id, x, y) {
    const wrap = document.createElement('div');
    wrap.className = 'canvas-node';
    wrap.style.left = `${x + _transform.x + LAYOUT.nodeW / 2}px`;
    wrap.style.top  = `${y + _transform.y + LAYOUT.nodeH / 2}px`;

    const node = document.createElement('div');
    node.className = `cnode node-${type}`;
    node.dataset.id = id;
    node.dataset.type = type;

    const titleEl = document.createElement('div');
    titleEl.className = 'node-title';
    titleEl.textContent = title;

    const metaEl = document.createElement('div');
    metaEl.className = 'node-meta';
    metaEl.textContent = id;

    node.appendChild(titleEl);
    node.appendChild(metaEl);
    wrap.appendChild(node);
    _nodesLayer.appendChild(wrap);

    return { x, y, el: wrap };
  }

  // ── Conectores SVG en canvas ────────────────────────────

  function _drawConnectors() {
    const ctx = _ctx;
    ctx.save();
    ctx.translate(_transform.x, _transform.y);
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);

    const rootPos = _nodePositions.get('__root__');
    if (!rootPos) { ctx.restore(); return; }

    const branches = (_data.branches || []);
    branches.forEach(branch => {
      const bp = _nodePositions.get(branch.branchId);
      if (!bp) return;
      _drawCurve(ctx,
        rootPos.x + LAYOUT.nodeW, rootPos.y + LAYOUT.nodeH / 2,
        bp.x, bp.y + LAYOUT.nodeH / 2
      );

      ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
      const subbranches = [...(branch.subbranches || [])].sort((a,b) => a.order - b.order);
      subbranches.forEach(sub => {
        const sp = _nodePositions.get(sub.subbranchId);
        if (!sp) return;
        _drawCurve(ctx,
          bp.x + LAYOUT.nodeW, bp.y + LAYOUT.nodeH / 2,
          sp.x, sp.y + LAYOUT.nodeH / 2
        );

        ctx.strokeStyle = 'rgba(220, 38, 38, 0.3)';
        (sub.leaves || []).forEach(leaf => {
          const lp = _nodePositions.get(leaf.leafId);
          if (!lp) return;
          _drawCurve(ctx,
            sp.x + LAYOUT.nodeW, sp.y + LAYOUT.nodeH / 2,
            lp.x, lp.y + LAYOUT.nodeH / 2
          );
        });
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
      });
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
    });
    ctx.restore();
  }

  function _drawCurve(ctx, x1, y1, x2, y2) {
    const cp1x = x1 + (x2 - x1) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cp1x, y1, cp1x, y2, x2, y2);
    ctx.stroke();
  }

  // ── Guía de secuencia ────────────────────────────────────

  function _drawSequenceGuide() {
    if (!_data || !(_data.branches || []).length) return;
    const ctx = _ctx;
    ctx.save();
    ctx.translate(_transform.x, _transform.y);
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);

    let prevPos = null;
    (_data.branches || []).forEach(branch => {
      const subs = [...(branch.subbranches || [])].sort((a,b) => a.order - b.order);
      subs.forEach(sub => {
        const sp = _nodePositions.get(sub.subbranchId);
        if (!sp) return;
        const cx = sp.x + LAYOUT.nodeW / 2;
        const cy = sp.y + LAYOUT.nodeH / 2;
        if (prevPos) {
          ctx.beginPath();
          ctx.moveTo(prevPos.x, prevPos.y);
          ctx.lineTo(cx, cy);
          ctx.stroke();
        }
        prevPos = { x: cx, y: cy };
      });
    });
    ctx.restore();
  }

  // ── Pan & Zoom ───────────────────────────────────────────

  function _onPanStart(e) {
    if (e.target !== _canvas) return;
    _isPanning = true;
    _panStart  = { x: e.clientX - _transform.x, y: e.clientY - _transform.y };
  }

  function _onPanMove(e) {
    if (!_isPanning) return;
    _transform.x = e.clientX - _panStart.x;
    _transform.y = e.clientY - _panStart.y;
    _updateNodePositions();
    render();
  }

  function _onPanEnd() { _isPanning = false; }

  function _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    _transform.scale = Math.min(Math.max(_transform.scale * factor, 0.3), 3);
    render();
  }

  function _updateNodePositions() {
    _nodesLayer.querySelectorAll('.canvas-node').forEach(wrap => {
      const pos = [..._nodePositions.values()].find(p => p.el && p.el === wrap);
      if (!pos) return;
      wrap.style.left = `${pos.x + _transform.x + LAYOUT.nodeW / 2}px`;
      wrap.style.top  = `${pos.y + _transform.y + LAYOUT.nodeH / 2}px`;
    });
  }

  // ── API pública ──────────────────────────────────────────

  function setData(orgName, branches, catalog) {
    _data    = { orgName, branches };
    _catalog = catalog;
    render();
  }

  function setShowSequence(val) {
    _showSequence = val;
    render();
  }

  function resetView() {
    _transform = { x: 0, y: 0, scale: 1 };
    render();
  }

  return { init, setData, setShowSequence, resetView, render };
})();

export default CanvasEngine;
