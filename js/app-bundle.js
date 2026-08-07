/**
 * app-bundle.js — Yggdrasil v3
 * ─────────────────────────────────────────────────────────────
 * • Recursividad N-aria: cualquier nodo puede tener subbranches[]
 *   y leaves[] sin límite de profundidad.
 * • Drill-Down View: clic en un nodo con hijos "entra" en él,
 *   mostrando sólo sus hijos directos + breadcrumb de ruta.
 * • Motor de animación CSS: drillIn (scale+fade slide) / drillOut.
 * • Paleta armónica muted (azul pizarra, ocre terroso, neutros).
 * • Sin servidor — funciona desde file:// con localStorage.
 */
(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  // DATOS INICIALES EMBEBIDOS
  // ══════════════════════════════════════════════════════════════

  var INITIAL_INDEX = {
    "version": "3.0",
    "organization": { "name": "Cofradia", "logo": "assets/images/logo.svg" },
    "audit": {
      "lastModified": "2026-08-04T21:10:00Z",
      "modifiedBy": "Anónimo",
      "changeDescription": "Inicialización v3 — Drill-Down + Recursividad N"
    },
    "platformCatalog": [
      { "platformId": "plat_youtube", "name": "YouTube",   "icon": "assets/icons/youtube.svg" },
      { "platformId": "plat_web",     "name": "Sitio Web", "icon": "assets/icons/web.svg" },
      { "platformId": "plat_spotify", "name": "Spotify",   "icon": "assets/icons/spotify.svg" },
      { "platformId": "plat_github",  "name": "GitHub",    "icon": "assets/icons/github.svg" }
    ],
    "mainBranchesIndex": [
      { "branchId": "rama_01", "order": 1, "title": "Recursos y Publicaciones",  "file": "data/branches/rama_01.json" },
      { "branchId": "rama_02", "order": 2, "title": "Entretenimiento y Medios",  "file": "data/branches/rama_02.json" }
    ]
  };

  var INITIAL_BRANCHES = {
    "rama_01": {
      "branchId": "rama_01", "branchTitle": "Recursos y Publicaciones", "thumbnail": null,
      "subbranches": [
        { "subbranchId": "subrama_01_1", "order": 1, "subbranchTitle": "Documentación y Guías",
          "thumbnail": null, "subbranches": [],
          "leaves": [{ "leafId": "leaf_01_1_1", "platformIdRef": "plat_web", "targetUrl": "https://ejemplo.com/guia-inicio", "description": "Guía de inicio rápido", "customThumbnail": null, "autoThumbnailUrl": null }] },
        { "subbranchId": "subrama_01_2", "order": 2, "subbranchTitle": "Tutoriales en Video",
          "thumbnail": null, "subbranches": [],
          "leaves": [{ "leafId": "leaf_01_2_1", "platformIdRef": "plat_youtube", "targetUrl": "https://youtube.com/watch?v=ejemplo", "description": "Tutorial introductorio en video", "customThumbnail": null, "autoThumbnailUrl": null }] }
      ],
      "leaves": []
    },
    "rama_02": {
      "branchId": "rama_02", "branchTitle": "Entretenimiento y Medios", "thumbnail": null,
      "subbranches": [
        { "subbranchId": "subrama_02_1", "order": 1, "subbranchTitle": "Música y Podcasts",
          "thumbnail": null, "subbranches": [],
          "leaves": [{ "leafId": "leaf_02_1_1", "platformIdRef": "plat_spotify", "targetUrl": "https://open.spotify.com/show/ejemplo", "description": "Podcast recomendado", "customThumbnail": null, "autoThumbnailUrl": null }] },
        { "subbranchId": "subrama_02_2", "order": 2, "subbranchTitle": "Canales de Video",
          "thumbnail": null, "subbranches": [],
          "leaves": [{ "leafId": "leaf_02_2_1", "platformIdRef": "plat_youtube", "targetUrl": "https://youtube.com/c/ejemplo", "description": "Canal educativo destacado", "customThumbnail": null, "autoThumbnailUrl": null }] }
      ],
      "leaves": []
    }
  };

  // ══════════════════════════════════════════════════════════════
  // GitStorage — localStorage
  // ══════════════════════════════════════════════════════════════
  var GitStorage = (function () {
    var P = 'ygg3_';
    function k(id) { return P + id; }
    function rd(id) { try { var r=localStorage.getItem(k(id)); return r ? JSON.parse(r) : null; } catch(e){return null;} }
    function wr(id,d) { try { localStorage.setItem(k(id),JSON.stringify(d)); } catch(e){} }
    function loadIndex() { return rd('__index__') || JSON.parse(JSON.stringify(INITIAL_INDEX)); }
    function loadBranch(id) { return rd(id) || (INITIAL_BRANCHES[id] ? JSON.parse(JSON.stringify(INITIAL_BRANCHES[id])) : null); }
    function saveIndex(d)      { wr('__index__',d); }
    function saveBranch(id,d)  { wr(id,d); }
    function downloadJSON(fn,d) {
      var b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
      var u=URL.createObjectURL(b); var a=document.createElement('a'); a.href=u; a.download=fn; a.click(); URL.revokeObjectURL(u);
    }
    return {loadIndex,loadBranch,saveIndex,saveBranch,downloadJSON};
  })();

  // ══════════════════════════════════════════════════════════════
  // SearchEngine
  // ══════════════════════════════════════════════════════════════
  var SearchEngine = (function () {
    var _i = [];
    function _subs(bId,bTitle,subs,path) {
      path=path||'';
      (subs||[]).forEach(function(s){
        var p=path?path+' › '+s.subbranchTitle:s.subbranchTitle;
        _i.push({type:'subbranch',branchId:bId,branchTitle:bTitle,subbranchId:s.subbranchId,subbranchTitle:s.subbranchTitle,pathLabel:p});
        _subs(bId,bTitle,s.subbranches||[],p);
        (s.leaves||[]).forEach(function(l){ _i.push({type:'leaf',branchId:bId,subbranchId:s.subbranchId,pathLabel:p,leafId:l.leafId,description:l.description||'',url:l.targetUrl||''}); });
      });
    }
    function addBranch(b) {
      _i=_i.filter(function(e){return e.branchId!==b.branchId;});
      _subs(b.branchId,b.branchTitle,b.subbranches||[]);
      (b.leaves||[]).forEach(function(l){ _i.push({type:'leaf',branchId:b.branchId,subbranchId:null,pathLabel:b.branchTitle,leafId:l.leafId,description:l.description||'',url:l.targetUrl||''}); });
    }
    function search(q) {
      if(!q||q.trim().length<2) return [];
      var lq=q.trim().toLowerCase();
      return _i.filter(function(x){ return [x.branchTitle,x.subbranchTitle,x.description,x.url,x.pathLabel].filter(Boolean).join(' ').toLowerCase().indexOf(lq)>-1; }).slice(0,20);
    }
    return {addBranch,search};
  })();

  // ══════════════════════════════════════════════════════════════
  // DragOrderEngine
  // ══════════════════════════════════════════════════════════════
  var DragOrderEngine = (function () {
    function init(container, sel, onReorder) {
      if(!container) return;
      var src=null;
      function items() { return Array.from(container.querySelectorAll(':scope > '+sel)); }
      function start(e){ src=this; this.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',this.dataset.id||''); }
      function over(e) { e.preventDefault(); if(this!==src){ items().forEach(function(x){x.classList.remove('drag-over');}); this.classList.add('drag-over'); } }
      function leave(){ this.classList.remove('drag-over'); }
      function drop(e) { e.stopPropagation(); e.preventDefault(); if(src&&this!==src){ var it=items(); it.indexOf(src)>it.indexOf(this)?container.insertBefore(src,this):container.insertBefore(src,this.nextSibling); onReorder(items().map(function(x){return x.dataset.id;}).filter(Boolean)); } this.classList.remove('drag-over'); }
      function end()  { this.classList.remove('dragging'); items().forEach(function(x){x.classList.remove('drag-over');}); }
      function attach(el){ el.setAttribute('draggable','true'); el.addEventListener('dragstart',start); el.addEventListener('dragover',over); el.addEventListener('dragleave',leave); el.addEventListener('drop',drop); el.addEventListener('dragend',end); }
      items().forEach(attach);
      return {attach,refresh:function(){items().forEach(attach);}};
    }
    function applyOrder(arr, key, order) {
      order.forEach(function(id,i){ var x=arr.find(function(a){return a[key]===id;}); if(x) x.order=i+1; });
      return arr.sort(function(a,b){return a.order-b.order;});
    }
    return {init,applyOrder};
  })();

  // ══════════════════════════════════════════════════════════════
  // CanvasEngine — Vista árbol canvas (actualizada palette)
  // ══════════════════════════════════════════════════════════════
  var CanvasEngine = (function () {
    var _cv,_ctx,_nl,_data;
    // _tr almacena el estado pan+zoom. _np guarda coordenadas en espacio-mundo
    // (sin transformación). La transformación se aplica en render() de una vez.
    var _tr={x:60,y:40,scale:1}, _pan=false, _ps={x:0,y:0};
    var _np=new Map(), _seq=true;
    var L={bx:220,sx:200,lx:180,vg:90,nw:180,nh:60};

    function init(cv,nl) {
      _cv=cv; _ctx=cv.getContext('2d'); _nl=nl; _resize();
      window.addEventListener('resize',_resize);
      // Pan: registrar offset en coordenadas de pantalla
      cv.addEventListener('mousedown',function(e){
        if(e.target!==_cv)return;
        _pan=true;
        _ps={x:e.clientX-_tr.x, y:e.clientY-_tr.y};
      });
      window.addEventListener('mousemove',function(e){
        if(!_pan)return;
        _tr.x=e.clientX-_ps.x; _tr.y=e.clientY-_ps.y;
        render();
      });
      window.addEventListener('mouseup',function(){_pan=false;});
      // Zoom centrado en el cursor
      cv.addEventListener('wheel',function(e){
        e.preventDefault();
        var f=e.deltaY>0?0.9:1.1;
        var rect=_cv.getBoundingClientRect();
        var mx=e.clientX-rect.left, my=e.clientY-rect.top;
        // Ajustar traslación para que el punto bajo el cursor no se mueva
        _tr.x=mx-(_tr.scale*f/1)*(mx-_tr.x)/_tr.scale;
        _tr.y=my-(_tr.scale*f/1)*(my-_tr.y)/_tr.scale;
        _tr.scale=Math.min(Math.max(_tr.scale*f,0.2),4);
        render();
      },{passive:false});
    }

    function _resize(){
      if(!_cv)return;
      var r=_cv.parentElement.getBoundingClientRect();
      _cv.width=r.width||800; _cv.height=r.height||600;
      render();
    }

    // render() — layout en mundo, después aplica transform pan+zoom global
    function render() {
      if(!_cv||!_ctx||!_data)return;
      _ctx.clearRect(0,0,_cv.width,_cv.height);
      _np.clear(); _nl.innerHTML='';

      // ── Calcular posiciones en espacio-mundo ─────────────
      var y=80, rx=60;
      _np.set('__root__',{x:rx,y:y});
      _mk('root',_data.orgName||'Yggdrasil','__root__',rx,y);
      y+=L.vg*1.5;
      (_data.branches||[]).forEach(function(b){
        var bx=rx+L.bx;
        _np.set(b.branchId,{x:bx,y:y});
        _mk('branch',b.branchTitle,b.branchId,bx,y);
        var ss=(b.subbranches||[]).slice().sort(function(a,c){return a.order-c.order;});
        ss.forEach(function(s){
          y+=L.vg; var sx=bx+L.sx;
          _np.set(s.subbranchId,{x:sx,y:y});
          _mk('subbranch',s.subbranchTitle,s.subbranchId,sx,y);
          (s.leaves||[]).forEach(function(l){
            y+=L.vg*0.85; var lx=sx+L.lx;
            _np.set(l.leafId,{x:lx,y:y});
            _mk('leaf',l.description||l.targetUrl,l.leafId,lx,y);
          });
          if((s.leaves||[]).length) y+=L.vg*0.3;
        });
        y+=L.vg;
      });

      // ── Dibujar líneas con transformación global ─────────
      _ctx.save();
      _ctx.translate(_tr.x,_tr.y);
      _ctx.scale(_tr.scale,_tr.scale);
      _lines();
      if(_seq) _drawSeq();
      _ctx.restore();

      // ── Sincronizar capa HTML con la misma transformación ─
      _syncHtml();
    }

    // Crea el nodo HTML (posición se fijará en _syncHtml)
    function _mk(type,title,id,x,y) {
      var w=document.createElement('div'); w.className='canvas-node'; w.dataset.nid=id;
      var n=document.createElement('div'); n.className='cnode node-'+type; n.dataset.id=id;
      var t=document.createElement('div'); t.className='node-title'; t.textContent=title;
      var m=document.createElement('div'); m.className='node-meta'; m.textContent=id;
      n.appendChild(t); n.appendChild(m); w.appendChild(n); _nl.appendChild(w);
    }

    // Aplica la transformación pan+scale a todos los nodos HTML superpuestos
    function _syncHtml() {
      _nl.querySelectorAll('.canvas-node').forEach(function(w){
        var id=w.dataset.nid; var p=id&&_np.get(id); if(!p)return;
        var sx=p.x*_tr.scale+_tr.x;
        var sy=p.y*_tr.scale+_tr.y;
        w.style.left=(sx+L.nw*_tr.scale/2)+'px';
        w.style.top =(sy+L.nh*_tr.scale/2)+'px';
        w.style.transform='translate(-50%,-50%) scale('+_tr.scale+')';
        w.style.transformOrigin='center center';
      });
    }

    // Curva Bézier en espacio-mundo (ctx ya tiene translate+scale aplicado)
    function _cv2(x1,y1,x2,y2){
      var cp=x1+(x2-x1)*0.5;
      _ctx.beginPath(); _ctx.moveTo(x1,y1);
      _ctx.bezierCurveTo(cp,y1,cp,y2,x2,y2); _ctx.stroke();
    }

    // Dibuja líneas de conexión — se llama dentro del bloque save/translate/scale
    function _lines() {
      _ctx.setLineDash([]);
      var rp=_np.get('__root__'); if(!rp)return;
      (_data.branches||[]).forEach(function(b){
        var bp=_np.get(b.branchId); if(!bp)return;
        _ctx.strokeStyle='rgba(220,38,38,0.55)'; _ctx.lineWidth=1.5/_tr.scale;
        _cv2(rp.x+L.nw,rp.y+L.nh/2,bp.x,bp.y+L.nh/2);
        (b.subbranches||[]).forEach(function(s){
          var sp=_np.get(s.subbranchId); if(!sp)return;
          _ctx.strokeStyle='rgba(245,158,11,0.55)'; _ctx.lineWidth=1.5/_tr.scale;
          _cv2(bp.x+L.nw,bp.y+L.nh/2,sp.x,sp.y+L.nh/2);
          (s.leaves||[]).forEach(function(l){
            var lp=_np.get(l.leafId); if(!lp)return;
            _ctx.strokeStyle='rgba(148,163,184,0.4)'; _ctx.lineWidth=1/_tr.scale;
            _cv2(sp.x+L.nw,sp.y+L.nh/2,lp.x,lp.y+L.nh/2);
          });
        });
      });
    }

    // Guía de secuencia — también dentro del bloque save/translate/scale
    function _drawSeq() {
      _ctx.strokeStyle='rgba(245,158,11,0.7)'; _ctx.lineWidth=1/_tr.scale; _ctx.setLineDash([4/_tr.scale,6/_tr.scale]);
      var prev=null;
      (_data.branches||[]).forEach(function(b){
        (b.subbranches||[]).slice().sort(function(a,c){return a.order-c.order;}).forEach(function(s){
          var sp=_np.get(s.subbranchId); if(!sp)return;
          var cx=sp.x+L.nw/2, cy=sp.y+L.nh/2;
          if(prev){_ctx.beginPath();_ctx.moveTo(prev.x,prev.y);_ctx.lineTo(cx,cy);_ctx.stroke();}
          prev={x:cx,y:cy};
        });
      });
      _ctx.setLineDash([]);
    }

    function setData(name,branches){ _data={orgName:name,branches:branches}; render(); }
    function setShowSequence(v){ _seq=v; render(); }
    function resetView(){ _tr={x:60,y:40,scale:1}; render(); }
    return {init,setData,setShowSequence,resetView,render};
  })();

  // ══════════════════════════════════════════════════════════════
  // DrillDown State — historial de navegación recursiva
  // ══════════════════════════════════════════════════════════════
  //
  // _navStack: Array de objetos {id, title, type, branchId, nodeRef}
  //   El primer elemento es siempre la raíz virtual.
  //   Cada "entrar" hace push; cada breadcrumb hace splice.
  //
  var _navStack = [];   // [{id:'__root__', title:'Raíz', nodeRef:null}, ...]
  var _animDir  = 'forward';   // 'forward' | 'back'

  function navRoot() {
    _navStack = [{ id: '__root__', title: (_indexData.organization||{}).name||'Inicio', nodeRef: null, branchId: null }];
    _animDir = 'back';
    renderView();
  }

  // Entra en un nodo hijo (branch o subbranch)
  function navEnter(nodeRef, branchId) {
    _navStack.push({ id: nodeRef.subbranchId||nodeRef.branchId, title: nodeRef.subbranchTitle||nodeRef.branchTitle, nodeRef: nodeRef, branchId: branchId });
    _animDir = 'forward';
    renderView();
  }

  // Salta a un punto concreto del historial por índice
  function navTo(idx) {
    _animDir = idx < _navStack.length - 1 ? 'back' : 'forward';
    _navStack = _navStack.slice(0, idx + 1);
    renderView();
  }

  // Nodo activo actual (tope de la pila)
  function currentNode() { return _navStack[_navStack.length - 1]; }

  // ══════════════════════════════════════════════════════════════
  // TreeRenderer — Drill-Down, recursividad N-aria
  // ══════════════════════════════════════════════════════════════
  var TreeRenderer = (function () {
    var _container, _onDataChange;

    function init(el, cb) { _container = el; _onDataChange = cb; }

    // ─ Render del nivel activo ────────────────────────────────
    function renderLevel(indexData, branchesMap, catalog, navStack, animDir) {
      if (!_container) return;

      var cur = navStack[navStack.length - 1];
      var depth = navStack.length - 1;  // 0 = raíz

      // ── Construir el contenido del nivel ─────────────────
      var levelEl = document.createElement('div');
      levelEl.className = 'drill-level ' + (animDir === 'forward' ? 'drill-enter' : 'drill-back');

      // ── Cabecera del nivel (sólo si no es raíz) ───────────
      if (depth > 0) {
        var hdr = document.createElement('div');
        hdr.className = 'level-header';
        var backBtn = document.createElement('button');
        backBtn.className = 'level-header-back';
        backBtn.innerHTML = '← Atrás';
        backBtn.addEventListener('click', function () { navTo(navStack.length - 2); });
        var titleWrap = document.createElement('div');
        titleWrap.innerHTML = '<div class="level-header-title">'+esc(cur.title)+'</div><div class="level-header-meta">Nivel '+depth+'</div>';
        var depthBadge = document.createElement('span');
        depthBadge.className = 'level-depth-badge';
        depthBadge.textContent = depth === 1 ? 'Rama principal' : 'Nivel ' + depth;
        hdr.appendChild(backBtn);
        hdr.appendChild(titleWrap);
        hdr.appendChild(depthBadge);
        levelEl.appendChild(hdr);
      }

      // ── Obtener los hijos directos del nodo activo ────────
      var children = [];   // array de nodos hijos (branch o subbranch)
      var leaves   = [];   // hojas directas del nivel
      var branchId = cur.branchId;

      if (depth === 0) {
        // Raíz: mostrar todas las ramas principales
        children = (indexData.mainBranchesIndex || [])
          .slice()
          .sort(function (a, b) { return a.order - b.order; })
          .map(function (e) {
            var bd = branchesMap.get(e.branchId);
            if (!bd) return null;
            return { id: e.branchId, title: e.title || bd.branchTitle, order: e.order, thumbnail: bd.thumbnail, subbranches: bd.subbranches || [], leaves: bd.leaves || [], _branchId: e.branchId, _entry: e, _isBranch: true };
          }).filter(Boolean);
      } else {
        // Sub-nivel: hijos del nodo activo
        var nodeRef = cur.nodeRef;
        if (nodeRef) {
          children = (nodeRef.subbranches || []).slice().sort(function (a, b) { return a.order - b.order; })
            .map(function (s) { return { id: s.subbranchId, title: s.subbranchTitle, order: s.order, thumbnail: s.thumbnail, subbranches: s.subbranches || [], leaves: s.leaves || [], _nodeRef: s, _branchId: branchId, _isBranch: false }; });
          leaves = nodeRef.leaves || [];
        }
      }

      // ── 1. PRIMER BLOQUE: Hojas / Plataformas (prioridad superior) ─
      if (leaves.length > 0 || depth > 0) {
        if (leaves.length > 0) {
          var lsec = document.createElement('div');
          lsec.className = 'leaves-section';
          lsec.innerHTML = '<div class="leaves-section-title">Plataformas · ' + leaves.length + ' enlace' + (leaves.length !== 1 ? 's' : '') + '</div>';
          var lg = document.createElement('div');
          lg.className = 'leaves-grid';
          leaves.forEach(function (leaf) {
            var plat = (catalog || []).find(function (p) { return p.platformId === leaf.platformIdRef; });
            var thumb = leaf.customThumbnail || leaf.autoThumbnailUrl || null;
            var li = document.createElement('div');
            li.className = 'leaf-item';
            li.dataset.id = leaf.leafId || '';
            li.dataset.branch = branchId || '';
            li.dataset.subbranch = cur.id !== '__root__' && cur.id !== branchId ? cur.id : '';
            // Thumbnail: prioridad 1 URL manual, prioridad 2 og:image, prioridad 3 icono SVG de plataforma
            var thumbHtml;
            if (thumb) {
              thumbHtml = '<div class="leaf-thumbnail"><img src="'+esc(thumb)+'" alt="" onerror="this.parentNode.innerHTML=\''+_platIconFallback(plat)+'\'"></div>';
            } else if (plat && plat.icon) {
              thumbHtml = '<div class="leaf-thumbnail leaf-thumbnail--icon">'+_platIconFallback(plat)+'</div>';
            } else {
              thumbHtml = '<div class="leaf-thumbnail leaf-thumbnail--empty"></div>';
            }
            li.innerHTML =
              thumbHtml +
              (plat ? '<img class="leaf-platform-icon" src="'+esc(plat.icon)+'" alt="'+esc(plat.name)+'" onerror="this.style.opacity=\'0\'">' : '') +
              '<div class="leaf-info"><span class="leaf-description">'+esc(leaf.description||'—')+'</span><a class="leaf-url" href="'+esc(leaf.targetUrl)+'" target="_blank" rel="noopener">'+esc(leaf.targetUrl)+'</a></div>' +
              '<div class="leaf-actions"><button class="btn-icon btn-edit-leaf" data-branch="'+esc(branchId||'')+'" data-subbranch="'+esc(li.dataset.subbranch)+'" data-id="'+esc(leaf.leafId||'')+'" title="Editar">✎</button><button class="btn-icon btn-delete-leaf" data-branch="'+esc(branchId||'')+'" data-subbranch="'+esc(li.dataset.subbranch)+'" data-id="'+esc(leaf.leafId||'')+'" title="Eliminar">✕</button></div>';
            lg.appendChild(li);
          });
          lsec.appendChild(lg);
          levelEl.appendChild(lsec);
        }
        // Botón añadir plataforma/enlace en este nivel (sólo si no es raíz)
        if (depth > 0) {
          var addLeafBtn = document.createElement('button');
          addLeafBtn.className = 'btn-add btn-add-leaf-here';
          addLeafBtn.dataset.branchId = branchId || '';
          addLeafBtn.dataset.parentId = cur.id;
          addLeafBtn.style.marginTop = leaves.length > 0 ? '8px' : '0';
          addLeafBtn.style.marginBottom = '20px';
          addLeafBtn.textContent = '+ Agregar plataforma aquí';
          levelEl.appendChild(addLeafBtn);
        }
      }

      // ── 2. SEGUNDO BLOQUE: Grid de Sub-ramas ─────────────────
      var grid = document.createElement('div');
      grid.className = 'nodes-grid';
      grid.dataset.level = depth;

      children.forEach(function (child) {
        grid.appendChild(_nodeCard(child, depth, indexData, branchesMap, catalog));
      });

      // CTA añadir sub-rama / nueva rama principal
      var cta = document.createElement('div');
      cta.className = 'add-node-card';
      cta.dataset.addLevel = depth;
      cta.dataset.branchId = branchId || '';
      cta.dataset.parentId = cur.id;
      cta.innerHTML = '<span class="add-icon">⊕</span><span>' + (depth === 0 ? 'Nueva Rama Principal' : 'Nueva Sub-rama') + '</span>';
      grid.appendChild(cta);
      levelEl.appendChild(grid);

      // ── Montar en el DOM ──────────────────────────────────
      _container.innerHTML = '';
      _container.appendChild(levelEl);

      // Drag & drop en el grid de este nivel
      if (depth === 0) {
        DragOrderEngine.init(grid, '.node-card[data-type="branch"]', function (newOrder) {
          DragOrderEngine.applyOrder(indexData.mainBranchesIndex, 'branchId', newOrder);
          _onDataChange && _onDataChange('index', indexData);
          renderLevel(indexData, branchesMap, catalog, navStack, 'forward');
        });
      } else {
        var parentRef = cur.nodeRef;
        if (parentRef && parentRef.subbranches) {
          DragOrderEngine.init(grid, '.node-card[data-type="sub"]', function (newOrder) {
            DragOrderEngine.applyOrder(parentRef.subbranches, 'subbranchId', newOrder);
            var bd = branchesMap.get(branchId);
            if (bd) { _onDataChange && _onDataChange(branchId, bd); }
            renderLevel(indexData, branchesMap, catalog, navStack, 'forward');
          });
        }
      }
    }

    // ─ Construye una tarjeta de nodo (branch o subbranch) ─────
    function _nodeCard(child, depth, indexData, branchesMap, catalog) {
      var hasChildren = (child.subbranches && child.subbranches.length > 0) || (child.leaves && child.leaves.length > 0);
      var card = document.createElement('div');
      card.className = 'node-card' + (hasChildren ? ' has-children' : '');
      card.dataset.id    = child.id;
      card.dataset.type  = child._isBranch ? 'branch' : 'sub';
      card.dataset.depth = Math.min(depth, 3);

      // Thumbnail
      card.innerHTML = _thumbHtml(child.thumbnail);

      // Header
      var subCount  = (child.subbranches || []).length;
      var leafCount = (child.leaves || []).length;
      card.innerHTML +=
        '<div class="card-header">' +
          '<span class="drag-handle" title="Arrastrar para reordenar">⠿</span>' +
          '<span class="card-order-badge">' + child.order + '</span>' +
          '<div class="card-title-group">' +
            '<div class="card-title">' + esc(child.title) + '</div>' +
            '<div class="card-id">' + esc(child.id) + '</div>' +
          '</div>' +
          '<div class="card-actions">' +
            '<button class="btn-icon btn-edit-node" data-id="'+esc(child.id)+'" data-branch="'+esc(child._branchId||'')+'" data-is-branch="'+(child._isBranch?'1':'0')+'" title="Editar">✎</button>' +
            (child._isBranch ? '<button class="btn-icon btn-export-branch" data-id="'+esc(child.id)+'" title="Exportar JSON">⬇</button>' : '') +
            '<button class="btn-icon btn-delete-node" data-id="'+esc(child.id)+'" data-branch="'+esc(child._branchId||'')+'" data-is-branch="'+(child._isBranch?'1':'0')+'" data-title="'+esc(child.title)+'" title="Eliminar">✕</button>' +
          '</div>' +
        '</div>';

      // Contador de hijos
      if (subCount > 0 || leafCount > 0) {
        card.innerHTML += '<div class="card-children-count">' +
          (subCount  > 0 ? '<span class="ccc-icon">⊞</span> '+subCount+' sub-rama'+(subCount>1?'s':'') : '') +
          (subCount > 0 && leafCount > 0 ? ' &nbsp;·&nbsp; ' : '') +
          (leafCount > 0 ? '<span class="ccc-icon">⊡</span> '+leafCount+' enlace'+(leafCount>1?'s':'') : '') +
          (hasChildren ? ' &nbsp;— <span style="color:var(--accent-primary);font-size:10px">clic para explorar →</span>' : '') +
          '</div>';
      }

      // Footer con acciones rápidas
      card.innerHTML +=
        '<div class="card-footer">' +
          '<button class="btn-add btn-add-sub-to-node" data-id="'+esc(child.id)+'" data-branch="'+esc(child._branchId||'')+'" data-is-branch="'+(child._isBranch?'1':'0')+'">+ Sub-rama</button>' +
          '<button class="btn-add btn-add-leaf-to-node" data-id="'+esc(child.id)+'" data-branch="'+esc(child._branchId||'')+'">+ Enlace</button>' +
        '</div>';

      // Drill-down click en la zona de título/thumbnail
      if (hasChildren) {
        card.addEventListener('click', function (e) {
          if (e.target.closest('button')) return;
          var ref = child._isBranch ? branchesMap.get(child.id) : child._nodeRef;
          if (ref) navEnter(ref, child._branchId);
        });
      }

      return card;
    }

    function _thumbHtml(src) {
      if (!src) return '<div class="card-thumbnail-placeholder"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
      return '<img class="card-thumbnail" src="'+esc(src)+'" alt="" onerror="this.style.display=\'none\'">';
    }

    // Genera el HTML interior del thumbnail de hoja cuando no hay imagen URL.
    // Si existe icono de plataforma lo muestra centrado; si no, deja fondo vacío.
    function _platIconFallback(plat) {
      if (!plat || !plat.icon) return '';
      // Devuelve HTML que cabe dentro de un div.leaf-thumbnail
      return '<img src="'+esc(plat.icon)+'" alt="'+esc(plat.name||'')+'" style="width:22px;height:22px;opacity:0.65;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">';
    }

    return { init, renderLevel };
  })();

  // ══════════════════════════════════════════════════════════════
  // UIController — Modales de edición
  // ══════════════════════════════════════════════════════════════
  var UIController = (function () {
    var _idx, _map, _onSave;

    function init(idx, map, onSave) { _idx=idx; _map=map; _onSave=onSave; _badge(); }

    function _badge() {
      var b=document.getElementById('audit-badge'); if(!b||!_idx)return;
      var a=_idx.audit||{};
      var d=a.lastModified?new Date(a.lastModified).toLocaleString('es',{dateStyle:'short',timeStyle:'short'}):'—';
      b.innerHTML='<strong>'+esc(a.modifiedBy||'Anónimo')+'</strong> · '+d; b.title=a.changeDescription||'';
    }
    function _audit(desc,author) {
      if(!_idx.audit)_idx.audit={};
      _idx.audit.lastModified=new Date().toISOString(); _idx.audit.modifiedBy=author||'Anónimo'; _idx.audit.changeDescription=desc||'Cambio';
      _badge(); GitStorage.saveIndex(_idx);
      toast('✓ ' + (desc||'Cambio guardado'), 'success');
    }
    function _uid(p){ return (p||'id')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6); }

    // ── Factory de modal ──────────────────────────────────────
    function _m(title,body,foot,lg) {
      var ov=document.createElement('div'); ov.className='modal-overlay';
      ov.innerHTML='<div class="modal'+(lg?' modal-lg':'')+'"><div class="modal-header"><span class="modal-title">'+title+'</span><button class="modal-close">×</button></div><div class="modal-body">'+body+'</div><div class="modal-footer">'+foot+'</div></div>';
      ov.querySelector('.modal-close').addEventListener('click',function(){_cl(ov);});
      ov.addEventListener('click',function(e){if(e.target===ov)_cl(ov);});
      document.body.appendChild(ov);
      requestAnimationFrame(function(){ov.classList.add('open');});
      return ov;
    }
    function _cl(ov){ ov.classList.remove('open'); ov.addEventListener('transitionend',function(){ov.remove();},{once:true}); }
    function _v(ov,t,msg){ var ex=ov.querySelector('.validation-msg'); if(ex)ex.remove(); var el=document.createElement('div'); el.className='validation-msg '+t; el.textContent=msg; ov.querySelector('.modal-body').insertBefore(el,ov.querySelector('.modal-body').firstChild); }
    function _au(){ return '<div class="audit-author-row"><span>✎ Autor:</span><input id="audit-author-input" placeholder="Anónimo" autocomplete="off"></div>'; }

    // ── Buscar un nodo por id en la estructura recursiva ──────
    function _findNode(subs, id) {
      for (var i=0; i<subs.length; i++) {
        if (subs[i].subbranchId===id) return subs[i];
        var f=_findNode(subs[i].subbranches||[],id); if(f) return f;
      }
      return null;
    }

    // ── Editar nodo (branch o subbranch) ──────────────────────
    function openEditNodeModal(nodeId, branchId, isBranch) {
      var bd=_map.get(branchId); if(!bd)return;
      var title, thumb, saveTitle, saveThumb;
      if(isBranch) {
        var entry=(_idx.mainBranchesIndex||[]).find(function(e){return e.branchId===nodeId;});
        if(!entry)return;
        title=bd.branchTitle; thumb=bd.thumbnail||'';
        saveTitle=function(t,th,a){ bd.branchTitle=t; bd.thumbnail=th||null; entry.title=t; GitStorage.saveBranch(branchId,bd); _audit('Rama editada: '+t,a); };
      } else {
        var node=_findNode(bd.subbranches||[],nodeId); if(!node)return;
        title=node.subbranchTitle; thumb=node.thumbnail||'';
        saveTitle=function(t,th,a){ node.subbranchTitle=t; node.thumbnail=th||null; GitStorage.saveBranch(branchId,bd); _audit('Nodo editado: '+t,a); };
      }
      var body='<div class="form-group"><label class="form-label">Título</label><input class="form-input" id="en-t" value="'+esc(title)+'"></div>'+
               '<div class="form-group"><label class="form-label">Miniatura (URL)</label><input class="form-input" id="en-th" value="'+esc(thumb)+'"></div>'+_au();
      var ov=_m('Editar nodo',body,'<button class="btn-ghost" id="en-c">Cancelar</button><button class="btn-primary" id="en-s">Guardar</button>');
      ov.querySelector('#en-c').addEventListener('click',function(){_cl(ov);});
      ov.querySelector('#en-s').addEventListener('click',function(){
        var t=ov.querySelector('#en-t').value.trim(); if(!t)return;
        saveTitle(t,ov.querySelector('#en-th').value.trim(),ov.querySelector('#audit-author-input').value.trim());
        _cl(ov); _onSave&&_onSave();
      });
    }

    // ── Nueva Rama Principal ──────────────────────────────────
    function openAddBranchModal() {
      var body='<div class="form-group"><label class="form-label">ID (sin espacios)</label><input class="form-input" id="nb-id" placeholder="rama_03"></div>'+
               '<div class="form-group"><label class="form-label">Título</label><input class="form-input" id="nb-title" placeholder="Mi nueva rama"></div>'+
               '<div class="form-group"><label class="form-label">Miniatura (URL, opcional)</label><input class="form-input" id="nb-thumb"></div>'+_au();
      var ov=_m('Nueva Rama Principal',body,'<button class="btn-ghost" id="nb-c">Cancelar</button><button class="btn-primary" id="nb-s">Crear</button>');
      ov.querySelector('#nb-c').addEventListener('click',function(){_cl(ov);});
      ov.querySelector('#nb-s').addEventListener('click',function(){
        var id=ov.querySelector('#nb-id').value.trim().replace(/\s+/g,'_');
        var t=ov.querySelector('#nb-title').value.trim();
        var th=ov.querySelector('#nb-thumb').value.trim();
        var a=ov.querySelector('#audit-author-input').value.trim();
        if(!id||!t){_v(ov,'error','ID y título son obligatorios.');return;}
        if((_idx.mainBranchesIndex||[]).some(function(e){return e.branchId===id;})){_v(ov,'error','El ID "'+id+'" ya existe.');return;}
        var mo=Math.max.apply(null,[0].concat((_idx.mainBranchesIndex||[]).map(function(e){return e.order;})));
        _idx.mainBranchesIndex.push({branchId:id,order:mo+1,title:t,file:'data/branches/'+id+'.json'});
        var bd={branchId:id,branchTitle:t,thumbnail:th||null,subbranches:[],leaves:[]};
        _map.set(id,bd); GitStorage.saveBranch(id,bd); _audit('Nueva rama: '+t,a);
        _cl(ov); _onSave&&_onSave();
      });
    }

    // ── Nueva Sub-rama (en cualquier nodo padre) ──────────────
    function openAddSubModal(parentId, branchId, isBranch) {
      var bd=_map.get(branchId); if(!bd)return;
      var parentArr;
      if(isBranch) { parentArr=bd.subbranches; }
      else { var pn=_findNode(bd.subbranches||[],parentId); if(!pn)return; parentArr=pn.subbranches||(pn.subbranches=[]); }
      var body='<div class="form-group"><label class="form-label">Título de la Sub-rama</label><input class="form-input" id="as-t" placeholder="Nuevo tema..."></div>'+_au();
      var ov=_m('Nueva Sub-rama',body,'<button class="btn-ghost" id="as-c">Cancelar</button><button class="btn-primary" id="as-s">Crear</button>');
      ov.querySelector('#as-c').addEventListener('click',function(){_cl(ov);});
      ov.querySelector('#as-s').addEventListener('click',function(){
        var t=ov.querySelector('#as-t').value.trim(); var a=ov.querySelector('#audit-author-input').value.trim(); if(!t)return;
        var mo=Math.max.apply(null,[0].concat(parentArr.map(function(s){return s.order;})));
        parentArr.push({subbranchId:_uid('sub'),order:mo+1,subbranchTitle:t,thumbnail:null,subbranches:[],leaves:[]});
        GitStorage.saveBranch(branchId,bd); _audit('Sub-rama añadida: '+t,a);
        _cl(ov); _onSave&&_onSave();
      });
    }

    // ── Nueva Hoja ────────────────────────────────────────────
    function openAddLeafModal(parentId, branchId) {
      var bd=_map.get(branchId); if(!bd)return;
      var catalog=_idx.platformCatalog||[];
      var pills=catalog.map(function(p){return '<label class="platform-pill" data-pid="'+esc(p.platformId)+'"><img src="'+esc(p.icon)+'" alt="'+esc(p.name)+'"><span>'+esc(p.name)+'</span></label>';}).join('');
      var body='<div class="form-group"><label class="form-label">Plataforma</label><div class="platform-picker">'+pills+'</div><input type="hidden" id="al-p" value=""></div>'+
               '<div class="form-group"><label class="form-label">URL destino</label><input class="form-input" id="al-u" placeholder="https://..."></div>'+
               '<div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="al-d"></div>'+
               '<div class="form-group"><label class="form-label">Miniatura (URL, opcional)</label><input class="form-input" id="al-t"><span class="form-hint">Vacío = fondo oscuro.</span></div>'+_au();
      var ov=_m('Agregar Enlace',body,'<button class="btn-ghost" id="al-c">Cancelar</button><button class="btn-primary" id="al-s">Agregar</button>');
      ov.querySelectorAll('.platform-pill').forEach(function(pill){
        pill.addEventListener('click',function(){ ov.querySelectorAll('.platform-pill').forEach(function(p){p.classList.remove('selected');}); pill.classList.add('selected'); ov.querySelector('#al-p').value=pill.dataset.pid; });
      });
      ov.querySelector('#al-c').addEventListener('click',function(){_cl(ov);});
      ov.querySelector('#al-s').addEventListener('click',function(){
        var plat=ov.querySelector('#al-p').value; var url=ov.querySelector('#al-u').value.trim();
        var desc=ov.querySelector('#al-d').value.trim(); var thumb=ov.querySelector('#al-t').value.trim();
        var author=ov.querySelector('#audit-author-input').value.trim();
        if(!plat||!url){_v(ov,'error','Selecciona una plataforma e ingresa la URL.');return;}
        var leaf={leafId:_uid('leaf'),platformIdRef:plat,targetUrl:url,description:desc||'',customThumbnail:thumb||null,autoThumbnailUrl:null};
        // Determinar dónde insertar la hoja
        var target;
        if(parentId===branchId||parentId==='__root__'||!parentId) { target=bd.leaves; }
        else { var pn=_findNode(bd.subbranches||[],parentId); target=pn?(pn.leaves||(pn.leaves=[])):bd.leaves; }
        target.push(leaf);
        GitStorage.saveBranch(branchId,bd); _audit('Enlace añadido: '+url,author);
        _cl(ov); _onSave&&_onSave();
      });
    }

    // ── Editar Hoja ───────────────────────────────────────────
    function openEditLeafModal(branchId, subbranchId, leafId) {
      var bd=_map.get(branchId); if(!bd)return;
      var leaf=null;
      if(subbranchId&&subbranchId!==branchId){ var sn=_findNode(bd.subbranches||[],subbranchId); if(sn) leaf=(sn.leaves||[]).find(function(l){return l.leafId===leafId;}); }
      if(!leaf) leaf=(bd.leaves||[]).find(function(l){return l.leafId===leafId;});
      if(!leaf)return;
      var catalog=_idx.platformCatalog||[];
      var pills=catalog.map(function(p){return '<label class="platform-pill'+(leaf.platformIdRef===p.platformId?' selected':'')+'" data-pid="'+esc(p.platformId)+'"><img src="'+esc(p.icon)+'" alt="'+esc(p.name)+'"><span>'+esc(p.name)+'</span></label>';}).join('');
      var body='<div class="form-group"><label class="form-label">Plataforma</label><div class="platform-picker">'+pills+'</div><input type="hidden" id="el-p" value="'+esc(leaf.platformIdRef||'')+'"></div>'+
               '<div class="form-group"><label class="form-label">URL destino</label><input class="form-input" id="el-u" value="'+esc(leaf.targetUrl||'')+'"></div>'+
               '<div class="form-group"><label class="form-label">Descripción</label><input class="form-input" id="el-d" value="'+esc(leaf.description||'')+'"></div>'+
               '<div class="form-group"><label class="form-label">Miniatura (URL)</label><input class="form-input" id="el-t" value="'+esc(leaf.customThumbnail||'')+'"></div>'+_au();
      var ov=_m('Editar Enlace',body,'<button class="btn-ghost" id="el-c">Cancelar</button><button class="btn-primary" id="el-s">Guardar</button>');
      ov.querySelectorAll('.platform-pill').forEach(function(pill){
        pill.addEventListener('click',function(){ ov.querySelectorAll('.platform-pill').forEach(function(p){p.classList.remove('selected');}); pill.classList.add('selected'); ov.querySelector('#el-p').value=pill.dataset.pid; });
      });
      ov.querySelector('#el-c').addEventListener('click',function(){_cl(ov);});
      ov.querySelector('#el-s').addEventListener('click',function(){
        var url=ov.querySelector('#el-u').value.trim(); if(!url){_v(ov,'error','La URL es obligatoria.');return;}
        leaf.platformIdRef=ov.querySelector('#el-p').value||leaf.platformIdRef;
        leaf.targetUrl=url; leaf.description=ov.querySelector('#el-d').value.trim();
        leaf.customThumbnail=ov.querySelector('#el-t').value.trim()||null;
        GitStorage.saveBranch(branchId,bd); _audit('Enlace editado: '+url,ov.querySelector('#audit-author-input').value.trim());
        _cl(ov); _onSave&&_onSave();
      });
    }

    // ── Eliminar (confirmación) ───────────────────────────────
    function openDeleteModal(title, onConfirm) {
      var ov=_m('Confirmar eliminación','<p style="color:var(--text-main)">¿Eliminar <strong>'+esc(title)+'</strong>? Esta acción no se puede deshacer.</p>','<button class="btn-ghost" id="dc-c">Cancelar</button><button class="btn-danger" id="dc-ok">Eliminar</button>');
      ov.querySelector('#dc-c').addEventListener('click',function(){_cl(ov);});
      ov.querySelector('#dc-ok').addEventListener('click',function(){_cl(ov);onConfirm();});
    }

    // ── Catálogo de plataformas ───────────────────────────────
    function openCatalogModal() {
      var cat=_idx.platformCatalog||[];
      var list=cat.map(function(p){return '<div class="platform-list-item"><img src="'+esc(p.icon)+'" alt="'+esc(p.name)+'" onerror="this.style.opacity=\'0.3\'"><span class="platform-name">'+esc(p.name)+'</span><span class="platform-id">'+esc(p.platformId)+'</span><button class="btn-icon btn-del-plat" data-pid="'+esc(p.platformId)+'">✕</button></div>';}).join('');
      var body='<div class="platform-list">'+list+'</div><hr style="border-color:var(--border-color);margin:12px 0">'+
               '<div class="form-group"><label class="form-label">Agregar plataforma</label>'+
               '<input class="form-input" id="np-id" placeholder="plat_twitch">'+
               '<input class="form-input" id="np-name" placeholder="Nombre" style="margin-top:6px">'+
               '<input class="form-input" id="np-icon" placeholder="assets/icons/twitch.svg" style="margin-top:6px">'+
               '<button class="btn-primary" id="np-add" style="margin-top:10px;width:100%">+ Agregar</button></div>'+_au();
      var ov=_m('Catálogo de Plataformas',body,'<button class="btn-primary" id="cat-close">Cerrar</button>',true);
      ov.querySelector('#cat-close').addEventListener('click',function(){_cl(ov);});
      ov.querySelector('#np-add').addEventListener('click',function(){
        var id=ov.querySelector('#np-id').value.trim().replace(/\s+/g,'_');
        var name=ov.querySelector('#np-name').value.trim(); var icon=ov.querySelector('#np-icon').value.trim();
        var a=ov.querySelector('#audit-author-input').value.trim();
        if(!id||!name){_v(ov,'error','ID y nombre son obligatorios.');return;}
        if(cat.some(function(p){return p.platformId===id;})){_v(ov,'error','El ID "'+id+'" ya existe.');return;}
        cat.push({platformId:id,name:name,icon:icon}); _audit('Plataforma añadida: '+name,a);
        _cl(ov); openCatalogModal();
      });
      ov.querySelectorAll('.btn-del-plat').forEach(function(btn){
        btn.addEventListener('click',function(){
          var pid=btn.dataset.pid; var p=cat.find(function(x){return x.platformId===pid;}); if(!p)return;
          openDeleteModal(p.name,function(){ _idx.platformCatalog=cat.filter(function(x){return x.platformId!==pid;}); _audit('Plataforma eliminada: '+p.name,'Sistema'); _cl(ov); openCatalogModal(); });
        });
      });
    }

    // ── Importar JSON ─────────────────────────────────────────
    function openImportModal() {
      var body='<div class="import-drop-zone" id="imp-zone"><span class="drop-icon">📂</span>Arrastra aquí un archivo .json de rama<br><small>o haz clic para seleccionarlo</small><input type="file" id="imp-file" accept=".json" style="display:none"></div><div id="imp-val"></div>'+_au();
      var ov=_m('Importar Rama JSON',body,'<button class="btn-ghost" id="imp-c">Cancelar</button><button class="btn-primary" id="imp-ok" disabled>Importar</button>');
      var parsed=null, zone=ov.querySelector('#imp-zone'), fi=ov.querySelector('#imp-file'), btn=ov.querySelector('#imp-ok');
      function proc(f){ var r=new FileReader(); r.onload=function(e){ try{ parsed=JSON.parse(e.target.result); if(!parsed.branchId||!parsed.branchTitle)throw new Error(); _v(ov,'success','✓ Válido: "'+parsed.branchTitle+'" ('+parsed.branchId+')'); btn.removeAttribute('disabled'); }catch(ex){ parsed=null; _v(ov,'error','✗ JSON inválido.'); btn.setAttribute('disabled',''); } }; r.readAsText(f); }
      zone.addEventListener('click',function(){fi.click();});
      fi.addEventListener('change',function(){if(fi.files[0])proc(fi.files[0]);});
      zone.addEventListener('dragover',function(e){e.preventDefault();zone.classList.add('drag-active');});
      zone.addEventListener('dragleave',function(){zone.classList.remove('drag-active');});
      zone.addEventListener('drop',function(e){e.preventDefault();zone.classList.remove('drag-active');if(e.dataTransfer.files[0])proc(e.dataTransfer.files[0]);});
      ov.querySelector('#imp-c').addEventListener('click',function(){_cl(ov);});
      btn.addEventListener('click',function(){
        if(!parsed)return; var a=ov.querySelector('#audit-author-input').value.trim();
        var ex=(_idx.mainBranchesIndex||[]).find(function(e){return e.branchId===parsed.branchId;});
        if(!ex){ var mo=Math.max.apply(null,[0].concat((_idx.mainBranchesIndex||[]).map(function(e){return e.order;}))); _idx.mainBranchesIndex.push({branchId:parsed.branchId,order:mo+1,title:parsed.branchTitle,file:'data/branches/'+parsed.branchId+'.json'}); }
        _map.set(parsed.branchId,parsed); GitStorage.saveBranch(parsed.branchId,parsed);
        _audit('Rama importada: '+parsed.branchTitle,a); _cl(ov); _onSave&&_onSave();
      });
    }

    return {init,openEditNodeModal,openAddBranchModal,openAddSubModal,openAddLeafModal,openEditLeafModal,openDeleteModal,openCatalogModal,openImportModal};
  })();

  // ══════════════════════════════════════════════════════════════
  // HELPERS GLOBALES
  // ══════════════════════════════════════════════════════════════
  function esc(s){ if(!s)return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  // ── Toast notifications ───────────────────────────────────
  var _toastContainer = null;
  function toast(msg, type) {
    if (!_toastContainer) {
      _toastContainer = document.createElement('div');
      _toastContainer.id = 'toast-container';
      document.body.appendChild(_toastContainer);
    }
    var t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    t.textContent = msg;
    _toastContainer.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('toast-show'); });
    setTimeout(function () {
      t.classList.remove('toast-show');
      t.addEventListener('transitionend', function () { t.remove(); }, { once: true });
    }, 3200);
  }

  // ══════════════════════════════════════════════════════════════
  // APP — Orquestador principal
  // ══════════════════════════════════════════════════════════════

  var _indexData   = null;
  var _branchesMap = new Map();
  var _currentView = 'grid';
  var _eventsBound = false;

  function boot() {
    try {
      _indexData = GitStorage.loadIndex();
      (_indexData.mainBranchesIndex || []).forEach(function (entry) {
        var bd = GitStorage.loadBranch(entry.branchId);
        if (bd) { _branchesMap.set(entry.branchId, bd); SearchEngine.addBranch(bd); }
        else { _branchesMap.set(entry.branchId, {branchId:entry.branchId,branchTitle:entry.title,thumbnail:null,subbranches:[],leaves:[]}); }
      });

      var orgName = ((_indexData.organization||{}).name)||'Yggdrasil';
      var orgLogo = ((_indexData.organization||{}).logo)||'';
      var ne=document.getElementById('org-name'); if(ne) ne.textContent=orgName;
      var le=document.getElementById('org-logo'); if(le&&orgLogo) le.src=orgLogo;
      document.title = orgName + ' · Yggdrasil';

      var gridEl  = document.getElementById('branches-grid');
      var canvasEl= document.getElementById('tree-canvas');
      var nodesEl = document.getElementById('canvas-nodes-layer');
      TreeRenderer.init(gridEl, onDataChange);
      CanvasEngine.init(canvasEl, nodesEl);
      UIController.init(_indexData, _branchesMap, refresh);

      // Inicializar pila de navegación en la raíz
      _navStack = [{ id: '__root__', title: orgName, nodeRef: null, branchId: null }];

      if (!_eventsBound) { bindHeader(); bindGrid(); _eventsBound = true; }

      removeSpinner();
      renderView();
    } catch (err) {
      console.error('[Yggdrasil]', err);
      removeSpinner();
      showError('Error al inicializar: ' + err.message);
    }
  }

  function removeSpinner() { var s=document.getElementById('loading-indicator'); if(s)s.remove(); }

  // ── Breadcrumb ────────────────────────────────────────────

  function renderBreadcrumb() {
    var bar = document.getElementById('breadcrumb-bar');
    var main = document.getElementById('app-main');
    if (!bar) return;
    if (_navStack.length <= 1) {
      bar.classList.add('hidden');
      if (main) main.classList.remove('has-breadcrumb');
      return;
    }
    bar.classList.remove('hidden');
    if (main) main.classList.add('has-breadcrumb');
    bar.innerHTML = '';
    _navStack.forEach(function (node, idx) {
      var item = document.createElement('div');
      item.className = 'bc-item';
      var btn = document.createElement('button');
      btn.className = 'bc-btn' + (idx === _navStack.length - 1 ? ' bc-current' : '');
      btn.textContent = node.title;
      if (idx < _navStack.length - 1) {
        btn.addEventListener('click', function () { navTo(idx); });
      }
      item.appendChild(btn);
      if (idx < _navStack.length - 1) {
        var sep = document.createElement('span');
        sep.className = 'bc-sep';
        sep.textContent = '/';
        item.appendChild(sep);
      }
      bar.appendChild(item);
    });
  }

  // ── Render principal ──────────────────────────────────────

  function renderView() {
    removeSpinner();
    var gv = document.getElementById('grid-view');
    var cv = document.getElementById('canvas-view');

    if (_currentView === 'grid') {
      gv.classList.remove('hidden');
      cv.classList.add('hidden');
      renderBreadcrumb();
      TreeRenderer.renderLevel(_indexData, _branchesMap, _indexData.platformCatalog || [], _navStack, _animDir);
    } else {
      gv.classList.add('hidden');
      cv.classList.remove('hidden');
      var bar = document.getElementById('breadcrumb-bar');
      if (bar) bar.classList.add('hidden');
      var main = document.getElementById('app-main');
      if (main) main.classList.remove('has-breadcrumb');
      var branches = (_indexData.mainBranchesIndex||[]).sort(function(a,b){return a.order-b.order;}).map(function(e){return _branchesMap.get(e.branchId);}).filter(Boolean);
      CanvasEngine.setData(((_indexData.organization||{}).name)||'Yggdrasil', branches);
    }
  }

  function setView(v) {
    _currentView = v;
    var bg=document.getElementById('btn-view-grid'), bc=document.getElementById('btn-view-canvas');
    if(bg){bg.classList.toggle('active',v==='grid');bg.setAttribute('aria-pressed',v==='grid');}
    if(bc){bc.classList.toggle('active',v==='canvas');bc.setAttribute('aria-pressed',v==='canvas');}
    renderView();
  }

  function refresh() { UIController.init(_indexData,_branchesMap,refresh); renderView(); }
  function onDataChange(id,data){ if(id==='index') GitStorage.saveIndex(data); else GitStorage.saveBranch(id,data); }

  // ── Eventos del Header (una vez) ─────────────────────────

  function bindHeader() {
    var bg=document.getElementById('btn-view-grid');
    var bc=document.getElementById('btn-view-canvas');
    var bab=document.getElementById('btn-add-branch-header');
    var boc=document.getElementById('btn-open-catalog');
    var bim=document.getElementById('btn-import-branch');
    var br=document.getElementById('btn-canvas-reset');
    var sq=document.getElementById('sequence-toggle');
    var si=document.getElementById('search-input');
    var sr=document.getElementById('search-results');

    var brd = document.getElementById('btn-reset-data');

    if(bg) bg.addEventListener('click',function(){setView('grid');});
    if(bc) bc.addEventListener('click',function(){setView('canvas');});
    if(bab) bab.addEventListener('click',function(){ UIController.openAddBranchModal(); });
    if(boc) boc.addEventListener('click',function(){ UIController.openCatalogModal(); });
    if(bim) bim.addEventListener('click',function(){ UIController.openImportModal(); });
    if(br) br.addEventListener('click',function(){ CanvasEngine.resetView(); });
    if(sq) sq.addEventListener('change',function(e){ CanvasEngine.setShowSequence(e.target.checked); });
    if(brd) brd.addEventListener('click',function(){
      UIController.openDeleteModal('TODOS los datos guardados (se restaurarán los datos de ejemplo)', function(){
        Object.keys(localStorage).filter(function(k){return k.indexOf('ygg3_')===0;}).forEach(function(k){localStorage.removeItem(k);});
        toast('Datos restaurados. Recargando…','success');
        setTimeout(function(){ window.location.reload(); }, 900);
      });
    });

    if(si) {
      si.addEventListener('input',function(){
        var q=si.value.trim(); if(q.length<2){sr.classList.remove('visible');return;}
        renderSearch(SearchEngine.search(q),sr);
      });
      si.addEventListener('blur',function(){setTimeout(function(){sr.classList.remove('visible');},200);});
    }
  }

  function renderSearch(results, container) {
    if(!results.length){container.classList.remove('visible');return;}
    container.classList.add('visible');
    container.innerHTML=results.map(function(r){
      var typeLabel = r.type==='leaf' ? '⊡ Enlace' : r.subbranchId ? '⊞ Sub-rama' : '◈ Rama';
      return '<div class="search-result-item" data-branch="'+esc(r.branchId)+'" data-sub="'+esc(r.subbranchId||'')+'" data-type="'+esc(r.type||'')+'" data-url="'+esc(r.url||'')+'">'+
        '<span class="result-title">'+esc(r.subbranchTitle||r.branchTitle||r.description||'')+'</span>'+
        '<span class="result-path"><span style="color:var(--text-faint);font-size:10px">'+typeLabel+'</span>  '+esc(r.pathLabel||r.branchTitle||'')+'</span>'+
        (r.type==='leaf'?'<span class="result-match">'+esc(r.url)+'</span>':'')+
      '</div>';
    }).join('');
    container.querySelectorAll('.search-result-item').forEach(function(item){
      item.addEventListener('click',function(){
        container.classList.remove('visible');
        var si = document.getElementById('search-input'); if(si) si.value='';
        var bid = item.dataset.branch;
        var sid = item.dataset.sub;
        var type = item.dataset.type;
        // Switch to grid view if needed
        if(_currentView!=='grid') setView('grid');
        // Navigate: always go to root first, then drill in
        navRoot();
        if(bid) {
          var branchData = _branchesMap.get(bid);
          if(branchData) {
            // Drill into the branch
            navEnter(branchData, bid);
            // If there's a subbranch target, drill into it too
            if(sid && type==='leaf') {
              var subRef = findNodeHelper(branchData.subbranches||[], sid);
              if(subRef) navEnter(subRef, bid);
            }
          }
        }
      });
    });
  }

  // ── Eventos de la Grid (delegación permanente, una sola vez) ─

  function bindGrid() {
    var gv = document.getElementById('grid-view');
    if (!gv) return;
    gv.addEventListener('click', function (e) {

      // CTA añadir nodo
      var cta = e.target.closest('.add-node-card');
      if (cta) {
        var depth   = parseInt(cta.dataset.addLevel || '0');
        var bid     = cta.dataset.branchId || null;
        var pid     = cta.dataset.parentId;
        if (depth === 0) { UIController.openAddBranchModal(); }
        else { UIController.openAddSubModal(pid, bid, false); }
        return;
      }

      var btn = e.target.closest('button'); if (!btn) return;

      // Editar nodo
      if (btn.classList.contains('btn-edit-node')) {
        UIController.openEditNodeModal(btn.dataset.id, btn.dataset.branch, btn.dataset.isBranch === '1');
        return;
      }

      // Exportar JSON de rama
      if (btn.classList.contains('btn-export-branch')) {
        var bd = _branchesMap.get(btn.dataset.id);
        if (bd) GitStorage.downloadJSON(btn.dataset.id + '.json', bd);
        return;
      }

      // Eliminar nodo (branch o subbranch)
      if (btn.classList.contains('btn-delete-node')) {
        var bid2 = btn.dataset.branch;
        var nid  = btn.dataset.id;
        var isBr = btn.dataset.isBranch === '1';
        UIController.openDeleteModal(btn.dataset.title || nid, function () {
          if (isBr) {
            _indexData.mainBranchesIndex = (_indexData.mainBranchesIndex||[]).filter(function(e){return e.branchId!==nid;});
            _branchesMap.delete(nid);
            GitStorage.saveIndex(_indexData);
            // Volver a la raíz si estamos dentro del nodo eliminado
            if (_navStack.some(function(n){return n.id===nid;})) navRoot();
            else refresh();
          } else {
            var branch2 = _branchesMap.get(bid2);
            if (!branch2) return;
            function removeFromSubs(subs, id) {
              for (var i=0;i<subs.length;i++) { if(subs[i].subbranchId===id){ subs.splice(i,1); return true; } if(removeFromSubs(subs[i].subbranches||[],id)) return true; }
              return false;
            }
            removeFromSubs(branch2.subbranches||[], nid);
            GitStorage.saveBranch(bid2, branch2);
            if (_navStack.some(function(n){return n.id===nid;})) { navTo(_navStack.length - 2); }
            else refresh();
          }
        });
        return;
      }

      // Añadir sub-rama a un nodo
      if (btn.classList.contains('btn-add-sub-to-node')) {
        UIController.openAddSubModal(btn.dataset.id, btn.dataset.branch, btn.dataset.isBranch === '1');
        return;
      }

      // Añadir hoja a un nodo
      if (btn.classList.contains('btn-add-leaf-to-node') || btn.classList.contains('btn-add-leaf-here')) {
        var pid2 = btn.dataset.parentId || btn.dataset.id;
        var bid3 = btn.dataset.branchId || btn.dataset.branch;
        UIController.openAddLeafModal(pid2, bid3);
        return;
      }

      // Editar hoja
      if (btn.classList.contains('btn-edit-leaf')) {
        UIController.openEditLeafModal(btn.dataset.branch, btn.dataset.subbranch || null, btn.dataset.id);
        return;
      }

      // Eliminar hoja
      if (btn.classList.contains('btn-delete-leaf')) {
        var lfId  = btn.dataset.id;
        var lbId  = btn.dataset.branch;
        var lsId  = btn.dataset.subbranch || null;
        var lbranch = _branchesMap.get(lbId); if (!lbranch) return;
        function findLeaf(subs, id) {
          for (var i=0;i<subs.length;i++){
            var idx2=(subs[i].leaves||[]).findIndex(function(l){return l.leafId===id;}); if(idx2>-1)return{arr:subs[i].leaves,idx:idx2};
            var f=findLeaf(subs[i].subbranches||[],id); if(f)return f;
          }
          return null;
        }
        var loc = lsId ? findLeaf([{leaves:(function(){var n=findNodeHelper(lbranch.subbranches||[],lsId);return n?n.leaves:[];}()),subbranchId:'_',subbranches:[]}], lfId) : null;
        if (!loc) { var di=(lbranch.leaves||[]).findIndex(function(l){return l.leafId===lfId;}); if(di>-1)loc={arr:lbranch.leaves,idx:di}; }
        if (!loc) { loc=findLeaf(lbranch.subbranches||[], lfId); }
        if (!loc) return;
        UIController.openDeleteModal(loc.arr[loc.idx].description||'Enlace', function(){
          loc.arr.splice(loc.idx,1); GitStorage.saveBranch(lbId,lbranch); refresh();
        });
        return;
      }
    });
  }

  function findNodeHelper(subs, id) {
    for (var i=0;i<subs.length;i++){ if(subs[i].subbranchId===id)return subs[i]; var f=findNodeHelper(subs[i].subbranches||[],id); if(f)return f; }
    return null;
  }

  function showError(msg) { toast(msg, 'error'); }

  // ── Arranque ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', boot);

})();
