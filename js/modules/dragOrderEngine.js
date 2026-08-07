/**
 * dragOrderEngine.js
 * Motor de reordenamiento dinámico por arrastre (Drag & Drop).
 * Implementación sobre HTML5 Drag & Drop API nativa.
 *
 * Uso:
 *   DragOrderEngine.init(containerEl, itemSelector, onReorder)
 *   onReorder(newOrderedIds) → callback para actualizar el JSON
 */

const DragOrderEngine = (() => {
  /**
   * Activa drag & drop sobre los hijos directos del contenedor.
   *
   * @param {HTMLElement} container    El elemento padre (ul, div, etc.)
   * @param {string}      itemSelector Selector CSS de los items arrastrables
   * @param {Function}    onReorder    Callback(newOrder: string[]) → ids en nuevo orden
   */
  function init(container, itemSelector, onReorder) {
    if (!container) return;

    let dragSrc = null;

    function getItems() {
      return [...container.querySelectorAll(`:scope > ${itemSelector}`)];
    }

    function handleDragStart(e) {
      dragSrc = this;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.dataset.id || '');
    }

    function handleDragOver(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.currentTarget;
      if (target !== dragSrc) {
        getItems().forEach(el => el.classList.remove('drag-over'));
        target.classList.add('drag-over');
      }
    }

    function handleDragLeave() {
      this.classList.remove('drag-over');
    }

    function handleDrop(e) {
      e.stopPropagation();
      e.preventDefault();
      if (dragSrc && this !== dragSrc) {
        const items = getItems();
        const srcIdx  = items.indexOf(dragSrc);
        const destIdx = items.indexOf(this);

        if (srcIdx > destIdx) {
          container.insertBefore(dragSrc, this);
        } else {
          container.insertBefore(dragSrc, this.nextSibling);
        }

        // Emitir nuevo orden como array de ids
        const newOrder = getItems().map(el => el.dataset.id).filter(Boolean);
        onReorder(newOrder);
      }
      this.classList.remove('drag-over');
      return false;
    }

    function handleDragEnd() {
      this.classList.remove('dragging');
      getItems().forEach(el => el.classList.remove('drag-over'));
    }

    function attachToItem(el) {
      el.setAttribute('draggable', 'true');
      el.addEventListener('dragstart',  handleDragStart);
      el.addEventListener('dragover',   handleDragOver);
      el.addEventListener('dragleave',  handleDragLeave);
      el.addEventListener('drop',       handleDrop);
      el.addEventListener('dragend',    handleDragEnd);
    }

    // Inicializar items existentes
    getItems().forEach(attachToItem);

    // Exponer método para agregar un nuevo item dinámicamente
    return {
      attachToItem,
      refresh() { getItems().forEach(attachToItem); },
    };
  }

  /**
   * Recalcula y asigna la propiedad `order` (1-based) a un array de objetos
   * dado el nuevo orden de ids.
   *
   * @param {Array<object>} items     Array de objetos con id y order
   * @param {string}        idKey     Nombre de la propiedad id (ej: 'branchId')
   * @param {string[]}      newOrder  IDs en nuevo orden
   * @returns {Array<object>} items con order actualizado
   */
  function applyOrder(items, idKey, newOrder) {
    newOrder.forEach((id, idx) => {
      const item = items.find(i => i[idKey] === id);
      if (item) item.order = idx + 1;
    });
    return items.sort((a, b) => a.order - b.order);
  }

  return { init, applyOrder };
})();

export default DragOrderEngine;
