const DEFAULT_PAGE_SIZE = 50;

let classificationResults = null;
let currentTheme = null;
let currentPage = 1;
let pageSize = DEFAULT_PAGE_SIZE;

let dom = {};

function $id(id) {
  return document.getElementById(id);
}

export function iniciarUI() {
  dom = {
    dropZone: $id('drop-zone'),
    statusPanel: $id('status-panel'),
    countValid: $id('count-valid'),
    countInvalid: $id('count-invalid'),
    btnClassify: $id('btn-classify'),
    progressContainer: $id('progress-container'),
    progressFill: $id('progress-fill'),
    progressText: $id('progress-text'),
    errorMessage: $id('error-message'),
    loadingSpinner: $id('loading-spinner'),
    loadingText: $id('loading-text'),
    resultsPanel: $id('results-panel'),
    resTotal: $id('res-total'),
    resDup: $id('res-dup'),
    resClass: $id('res-class'),
    themesList: $id('themes-list'),
    shortcutsDisplay: $id('shortcuts-display'),
    searchThemes: $id('search-themes'),
    btnExportJson: $id('btn-export-json'),
    btnExportHtml: $id('btn-export-html'),
    addUrlBar: $id('add-url-bar'),
    inputNuevaUrl: $id('input-nueva-url'),
    btnAddUrl: $id('btn-add-url'),
    addurlCategoria: $id('addurl-categoria'),
    addurlNuevaCatContainer: $id('addurl-nueva-categoria-container'),
    addurlNuevaCatInput: $id('addurl-nueva-categoria'),
    pagination: $id('pagination'),
    pageInfo: $id('page-info'),
    btnPrev: $id('btn-prev'),
    btnNext: $id('btn-next'),
    pageSize: $id('page-size'),
    btnReiniciar: $id('btn-reiniciar'),
  };

  iniciarBuscador();

  if (!esNavegadorCompatible()) {
    mostrarError('El teu navegador no suporta la lectura de carpetes. Utilitza Chrome, Edge o Brave.');
    dom.dropZone.style.opacity = '0.5';
    dom.dropZone.style.cursor = 'not-allowed';
  }
}

function esNavegadorCompatible() {
  return (
    typeof DataTransferItem !== 'undefined' &&
    typeof DataTransferItem.prototype.webkitGetAsEntry === 'function'
  );
}

export function mostrarError(mensaje) {
  dom.errorMessage.textContent = mensaje;
  dom.errorMessage.classList.remove('hidden');
  dom.errorMessage.setAttribute('role', 'alert');
}

export function limpiarError() {
  dom.errorMessage.classList.add('hidden');
  dom.errorMessage.textContent = '';
}

export function actualizarProgreso(leidos, invalidos) {
  dom.progressContainer.classList.remove('hidden');
  dom.countValid.textContent = leidos;
  dom.countInvalid.textContent = invalidos;
  const total = leidos + invalidos;
  if (total > 0) {
    dom.progressFill.style.width = `${Math.min((leidos / Math.max(total, 1)) * 100, 100)}%`;
    dom.progressText.textContent = `Llegits: ${leidos} fitxers .url vàlids, ${invalidos} ignorats`;
  }
}

export function ocultarProgreso() {
  dom.progressContainer.classList.add('hidden');
  dom.progressFill.style.width = '0%';
}

export function mostrarPanelStatus(visible) {
  dom.statusPanel.classList.toggle('hidden', !visible);
}

export function ocultarPanelImportacion() {
  dom.statusPanel.classList.add('hidden');
}

export function habilitarBotonClasificar(habilitado) {
  dom.btnClassify.disabled = !habilitado;
}

export function mostrarCarga(visible, texto) {
  dom.loadingSpinner.classList.toggle('hidden', !visible);
  if (texto) {dom.loadingText.textContent = texto;}
}

let urlDestacada = null;

export function mostrarResultados(data, urlHighlight, selectedCategory) {
  classificationResults = data;
  urlDestacada = urlHighlight || null;
  ocultarPanelImportacion();
  dom.resultsPanel.classList.remove('hidden');
  dom.resTotal.textContent = data.totalRecibidos;
  dom.resDup.textContent = data.totalDuplicados;
  dom.resClass.textContent = data.totalClasificados;

  dom.themesList.innerHTML = '';
  dom.shortcutsDisplay.innerHTML =
    '<p class="select-prompt">Selecciona una temàtica de l\'esquerra per veure els accessos directes.</p>';
  dom.pagination.classList.add('hidden');

  if (!data.tematicas || data.tematicas.length === 0) {
    dom.themesList.innerHTML = '<p>No s\'han classificat elements.</p>';
    return;
  }

  data.tematicas.forEach((tematica, index) => {
    const item = document.createElement('div');
    item.className = 'theme-item';

    const button = document.createElement('button');
    button.className = 'btn-theme';
    button.textContent = `${tematica.nombre} (${tematica.accesos.length})`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', 'false');
    button.dataset.themeIndex = index;
    button.addEventListener('click', () => seleccionarTema(index));

    // make category droppable
    button.addEventListener('dragover', (e) => {
      e.preventDefault();
      button.classList.add('drag-over');
    });
    button.addEventListener('dragleave', () => {
      button.classList.remove('drag-over');
    });
    button.addEventListener('drop', (e) => {
      e.preventDefault();
      button.classList.remove('drag-over');
      const data = e.dataTransfer.getData('text/plain');
      if (data && onReclasificarCallback) {
        try {
          const { url, nombreArchivo, desdeCategoria } = JSON.parse(data);
          const hastaCategoria = tematica.nombre;
          if (desdeCategoria !== hastaCategoria) {
            onReclasificarCallback({ url, nombreArchivo, desdeCategoria, hastaCategoria });
          }
        } catch { /* ignore */ }
      }
    });

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-theme-edit';
    editBtn.textContent = '✎';
    editBtn.title = 'Renombrar categoria';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      mostrarModalRenombrar(tematica.nombre);
    });

    item.appendChild(button);
    item.appendChild(editBtn);
    dom.themesList.appendChild(item);
  });

  dom.themesList.setAttribute('role', 'tablist');
  dom.shortcutsDisplay.setAttribute('role', 'tabpanel');
  dom.shortcutsDisplay.setAttribute('aria-label', 'Accessos directes classificats');

  dom.searchThemes.value = '';
  dom.searchThemes.disabled = false;
  dom.btnExportJson.disabled = false;
  dom.btnExportHtml.disabled = false;
  dom.btnReiniciar.disabled = false;
  dom.addUrlBar.classList.remove('hidden');
  poblarCategoriasAddUrl();

  if (selectedCategory) {
    seleccionarCategoriaPorNombre(selectedCategory);
  } else {
    seleccionarTema(0);
  }
}

function seleccionarTema(index) {
  if (!classificationResults || !classificationResults.tematicas[index]) {return;}

  const botones = dom.themesList.querySelectorAll('.btn-theme');
  botones.forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
    btn.setAttribute('aria-selected', i === index);
  });

  if (currentTheme !== index) {
    currentPage = 1;
  }
  currentTheme = index;
  renderizarAccesos();
}

function renderizarAccesos() {
  if (currentTheme === null || !classificationResults) {return;}

  const tematica = classificationResults.tematicas[currentTheme];
  const accesos = tematica.accesos;

  // Sort alphabetically by nombreNuevo
  const accesosOrdenats = [...accesos].sort((a, b) =>
    a.nombreNuevo.localeCompare(b.nombreNuevo)
  );

  const totalPages = Math.max(1, Math.ceil(accesos.length / pageSize));
  if (currentPage > totalPages) {currentPage = totalPages;}
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, accesos.length);
  const pageAccesos = accesosOrdenats.slice(start, end);

  dom.shortcutsDisplay.innerHTML = '';
  dom.pagination.classList.remove('hidden');

  // ── Category Header ──
  const header = document.createElement('div');
  header.className = 'category-header';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'cat-header-name';
  nameSpan.textContent = tematica.nombre;

  const countSpan = document.createElement('span');
  countSpan.className = 'cat-header-count';
  countSpan.textContent = `${accesos.length} ENLLAÇOS`;

  const pageNav = document.createElement('span');
  pageNav.className = 'cat-header-pages';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'cat-page-btn';
  prevBtn.textContent = '‹';
  prevBtn.disabled = currentPage <= 1;
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); paginaAnterior(); });

  const pageText = document.createElement('span');
  pageText.textContent = `PÀG ${currentPage} de ${totalPages}`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'cat-page-btn';
  nextBtn.textContent = '›';
  nextBtn.disabled = currentPage >= totalPages;
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); paginaSiguiente(); });

  pageNav.appendChild(prevBtn);
  pageNav.appendChild(pageText);
  pageNav.appendChild(nextBtn);

  header.appendChild(nameSpan);
  header.appendChild(countSpan);
  header.appendChild(pageNav);

  dom.shortcutsDisplay.appendChild(header);

  // ── Grid wrapper ──
  const grid = document.createElement('div');
  grid.className = 'shortcuts-grid';

  pageAccesos.forEach((acceso) => {
    const isFav = tematica.nombre === 'FAVORITS';
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    if (esFavorito(acceso.url) && !isFav) {
      item.classList.add('is-favorite');
    }
    item.draggable = true;
    item.dataset.url = acceso.url;
    item.dataset.archivo = acceso.nombreOriginal;
    item.dataset.categoria = tematica.nombre;

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        url: acceso.url,
        nombreArchivo: acceso.nombreOriginal,
        desdeCategoria: tematica.nombre,
      }));
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    const headerRow = document.createElement('div');
    headerRow.className = 'shortcut-header';

    const title = document.createElement('h4');
    title.textContent = acceso.nombreNuevo;

    const actions = document.createElement('div');
    actions.className = 'shortcut-actions';

    const btnEditName = document.createElement('button');
    btnEditName.className = 'btn-icon';
    btnEditName.textContent = '✏️';
    btnEditName.title = 'Editar nom';
    btnEditName.addEventListener('click', (e) => {
      e.stopPropagation();
      mostrarModalEditarNombre(acceso.url, acceso.nombreOriginal, acceso.nombreNuevo);
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-icon btn-delete';
    btnDelete.textContent = '🗑️';
    btnDelete.title = 'Eliminar marcador';
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      mostrarModalEliminar(acceso.url, acceso.nombreOriginal);
    });

    const btnFav = document.createElement('button');
    btnFav.className = 'btn-icon btn-fav';
    if (isFav) {
      btnFav.textContent = '★';
      btnFav.title = 'Treure de Favorits';
    } else {
      btnFav.textContent = '☆';
      btnFav.title = 'Copiar a Favorits';
    }
    btnFav.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isFav) {
        if (onQuitarFavoritoCallback) {
          onQuitarFavoritoCallback({ url: acceso.url });
        }
      } else {
        if (onFavoritoCallback) {
          btnFav.textContent = '★';
          onFavoritoCallback({ url: acceso.url, nombreOriginal: acceso.nombreOriginal });
        }
      }
    });

    actions.appendChild(btnFav);
    actions.appendChild(btnEditName);
    if (!isFav) {
      actions.appendChild(btnDelete);
    }

    headerRow.appendChild(title);
    headerRow.appendChild(actions);

    const link = document.createElement('a');
    link.href = acceso.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = acceso.url;

    const original = document.createElement('span');
    original.className = 'original-name';
    original.textContent = `Fitxer d'origen: ${acceso.nombreOriginal}`;

    // Date
    const dateSpan = document.createElement('span');
    dateSpan.className = 'shortcut-date';
    if (acceso.dataAlta) {
      const d = new Date(acceso.dataAlta);
      dateSpan.textContent = `Afegit: ${d.toLocaleDateString('ca-ES', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    }

    if (urlDestacada && acceso.url === urlDestacada) {
      item.classList.add('highlighted');
    }

    item.appendChild(headerRow);
    item.appendChild(link);
    item.appendChild(original);
    item.appendChild(dateSpan);
    if (!isFav) {
      const btnMove = document.createElement('button');
      btnMove.className = 'btn-reclasificar';
      btnMove.textContent = 'Moure';
      btnMove.dataset.url = acceso.url;
      btnMove.dataset.archivo = acceso.nombreOriginal;
      btnMove.addEventListener('click', () =>
        mostrarModalReclasificar(acceso.url, acceso.nombreOriginal, tematica.nombre)
      );
      item.appendChild(btnMove);
    }
    grid.appendChild(item);
  });

  dom.shortcutsDisplay.appendChild(grid);

  if (urlDestacada) {
    const highlighted = dom.shortcutsDisplay.querySelector('.highlighted');
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    setTimeout(() => {
      dom.shortcutsDisplay.querySelectorAll('.highlighted').forEach((el) => el.classList.remove('highlighted'));
      urlDestacada = null;
    }, 3000);
  }

  dom.pageInfo.textContent = `Pàgina ${currentPage} de ${totalPages} (${accesos.length} accessos)`;
  dom.btnPrev.disabled = currentPage <= 1;
  dom.btnNext.disabled = currentPage >= totalPages;

  dom.btnPrev.setAttribute('aria-label', 'Pàgina anterior');
  dom.btnNext.setAttribute('aria-label', 'Pàgina següent');
}

export function ocultarResultados() {
  dom.resultsPanel.classList.add('hidden');
}

export function exportarResultados() {
  if (!classificationResults) {return;}
  const blob = new Blob([JSON.stringify(classificationResults, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `classificacio_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function configurarPaginacion() {
  pageSize = parseInt(dom.pageSize.value, 10);
  currentPage = 1;
  renderizarAccesos();
}

export function paginaAnterior() {
  if (currentPage > 1) {
    currentPage--;
    renderizarAccesos();
    dom.shortcutsDisplay.focus();
  }
}

export function paginaSiguiente() {
  const tematica = classificationResults?.tematicas[currentTheme];
  if (tematica) {
    const totalPages = Math.ceil(tematica.accesos.length / pageSize);
    if (currentPage < totalPages) {
      currentPage++;
      renderizarAccesos();
      dom.shortcutsDisplay.focus();
    }
  }
}

let searchMode = 'categories'; // 'categories' | 'links'

export function iniciarBuscador() {
  const tabCat = document.getElementById('search-tab-cat');
  const tabLink = document.getElementById('search-tab-link');

  tabCat.addEventListener('click', () => {
    searchMode = 'categories';
    tabCat.classList.add('active');
    tabCat.setAttribute('aria-selected', 'true');
    tabLink.classList.remove('active');
    tabLink.setAttribute('aria-selected', 'false');
    dom.searchThemes.placeholder = 'Cercar categoria...';
    dom.searchThemes.value = '';
    dom.searchThemes.disabled = false;
    if (classificationResults) {
      filtrarTematicas('');
      seleccionarTema(0);
    }
  });

  tabLink.addEventListener('click', () => {
    searchMode = 'links';
    tabLink.classList.add('active');
    tabLink.setAttribute('aria-selected', 'true');
    tabCat.classList.remove('active');
    tabCat.setAttribute('aria-selected', 'false');
    dom.searchThemes.placeholder = 'Cercar enllaços per nom o URL...';
    dom.searchThemes.value = '';
    dom.searchThemes.disabled = false;
    dom.shortcutsDisplay.innerHTML =
      '<p class="select-prompt">Escriu per cercar enllaços a totes les categories.</p>';
    dom.pagination.classList.add('hidden');
    dom.themesList.querySelectorAll('.btn-theme').forEach((btn) => { btn.style.display = ''; });
  });
}

export function realizarBusqueda(query) {
  if (searchMode === 'categories') {
    filtrarTematicas(query);
  } else {
    buscarEnlaces(query);
  }
}

function buscarEnlaces(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    dom.shortcutsDisplay.innerHTML =
      '<p class="select-prompt">Escriu per cercar enllaços a totes les categories.</p>';
    dom.pagination.classList.add('hidden');
    return;
  }
  if (!classificationResults) {return;}

  const resultados = [];
  for (const t of classificationResults.tematicas) {
    for (const a of t.accesos) {
      const enNombre = a.nombreNuevo.toLowerCase().includes(q);
      const enUrl = a.url.toLowerCase().includes(q);
      const enOriginal = a.nombreOriginal.toLowerCase().includes(q);
      if (enNombre || enUrl || enOriginal) {
        resultados.push({ ...a, categoria: t.nombre });
      }
    }
  }

  if (resultados.length === 0) {
    dom.shortcutsDisplay.innerHTML =
      '<p class="select-prompt">No s\'han trobat resultats per a la teva cerca.</p>';
    dom.pagination.classList.add('hidden');
    return;
  }

  dom.shortcutsDisplay.innerHTML = '';
  dom.pagination.classList.add('hidden');

  const grid = document.createElement('div');
  grid.className = 'shortcuts-grid';

  resultados.forEach((acceso) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    if (esFavorito(acceso.url)) {
      item.classList.add('is-favorite');
    }
    item.draggable = true;
    item.dataset.url = acceso.url;
    item.dataset.archivo = acceso.nombreOriginal;
    item.dataset.categoria = acceso.categoria;

    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({
        url: acceso.url,
        nombreArchivo: acceso.nombreOriginal,
        desdeCategoria: acceso.categoria,
      }));
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    const headerRow = document.createElement('div');
    headerRow.className = 'shortcut-header';

    const title = document.createElement('h4');
    title.textContent = acceso.nombreNuevo;

    const actions = document.createElement('div');
    actions.className = 'shortcut-actions';

    const btnFav = document.createElement('button');
    btnFav.className = 'btn-icon btn-fav';
    if (esFavorito(acceso.url)) {
      btnFav.textContent = '★';
      btnFav.title = 'Treure de Favorits';
    } else {
      btnFav.textContent = '☆';
      btnFav.title = 'Copiar a Favorits';
    }
    btnFav.addEventListener('click', (e) => {
      e.stopPropagation();
      if (esFavorito(acceso.url)) {
        if (onQuitarFavoritoCallback) {
          btnFav.textContent = '☆';
          onQuitarFavoritoCallback({ url: acceso.url });
        }
      } else {
        if (onFavoritoCallback) {
          btnFav.textContent = '★';
          onFavoritoCallback({ url: acceso.url, nombreOriginal: acceso.nombreOriginal });
        }
      }
    });

    const btnEditName = document.createElement('button');
    btnEditName.className = 'btn-icon';
    btnEditName.textContent = '✏️';
    btnEditName.title = 'Editar nom';
    btnEditName.addEventListener('click', (e) => {
      e.stopPropagation();
      mostrarModalEditarNombre(acceso.url, acceso.nombreOriginal, acceso.nombreNuevo);
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-icon btn-delete';
    btnDelete.textContent = '🗑️';
    btnDelete.title = 'Eliminar marcador';
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      mostrarModalEliminar(acceso.url, acceso.nombreOriginal);
    });

    actions.appendChild(btnFav);
    actions.appendChild(btnEditName);
    actions.appendChild(btnDelete);

    headerRow.appendChild(title);
    headerRow.appendChild(actions);
    item.appendChild(headerRow);

    const catLabel = document.createElement('span');
    catLabel.className = 'search-cat-label';
    catLabel.textContent = `📁 ${acceso.categoria}`;
    item.appendChild(catLabel);

    const link = document.createElement('a');
    link.href = acceso.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = acceso.url;
    item.appendChild(link);

    // Date
    const dateSpan = document.createElement('span');
    dateSpan.className = 'shortcut-date';
    if (acceso.dataAlta) {
      const d = new Date(acceso.dataAlta);
      dateSpan.textContent = `Afegit: ${d.toLocaleDateString('ca-ES', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    }
    item.appendChild(dateSpan);

    grid.appendChild(item);
  });

  dom.shortcutsDisplay.appendChild(grid);
}

export function filtrarTematicas(query) {
  const q = query.toLowerCase();
  dom.themesList.querySelectorAll('.btn-theme').forEach((btn) => {
    const coincide = btn.textContent.toLowerCase().includes(q);
    btn.style.display = coincide ? '' : 'none';
    if (!coincide && btn.classList.contains('active')) {
      btn.classList.remove('active');
      btn.setAttribute('aria-selected', 'false');
      dom.shortcutsDisplay.innerHTML =
        '<p class="select-prompt">La categoria seleccionada està oculta pel filtre.</p>';
      dom.pagination.classList.add('hidden');
    }
  });

  if (q === '' && currentTheme !== null) {
    const botones = dom.themesList.querySelectorAll('.btn-theme');
    if (botones[currentTheme]) {
      botones[currentTheme].classList.add('active');
      botones[currentTheme].setAttribute('aria-selected', 'true');
      renderizarAccesos();
    }
  }
}

// ── Stats list viewer ──

function getTodasUrls() {
  if (!classificationResults) {return [];}
  const urls = [];
  for (const t of classificationResults.tematicas) {
    for (const a of t.accesos) {
      urls.push({ url: a.url, nombre: a.nombreNuevo, categoria: t.nombre });
    }
  }
  return urls;
}

function mostrarModalMensaje(titulo, mensaje) {
  const overlay = document.getElementById('modal-listado');
  const tituloEl = document.getElementById('listado-titulo');
  const contenido = document.getElementById('listado-contenido');
  const cerrar = document.getElementById('btn-listado-cerrar');

  tituloEl.textContent = titulo;
  contenido.innerHTML = `<p style="color:var(--text-secondary);line-height:1.6;">${mensaje}</p>`;
  overlay.classList.remove('hidden');

  function cerrarModal() {
    overlay.classList.add('hidden');
    cerrar.removeEventListener('click', cerrarModal);
    document.removeEventListener('keydown', onKeyDown);
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {cerrarModal();}
  };

  cerrar.addEventListener('click', cerrarModal);
  document.addEventListener('keydown', onKeyDown);
  cerrar.focus();
}

export function mostrarModalReiniciar(onConfirm) {
  const overlay = document.getElementById('modal-reiniciar');
  const input = document.getElementById('reiniciar-confirm-input');
  const btnConfirmar = document.getElementById('btn-reiniciar-confirmar');
  const btnCancelar = document.getElementById('btn-reiniciar-cancelar');

  input.value = '';
  input.style.borderColor = '';
  btnConfirmar.disabled = true;

  overlay.classList.remove('hidden');
  input.focus();

  function onInput() {
    btnConfirmar.disabled = input.value.trim() !== 'REINICIAR';
  }

  function cerrar() {
    overlay.classList.add('hidden');
    input.removeEventListener('input', onInput);
    btnConfirmar.removeEventListener('click', onConfirmar);
    btnCancelar.removeEventListener('click', cerrar);
    document.removeEventListener('keydown', onKeyDown);
  }

  function onConfirmar() {
    if (input.value.trim() !== 'REINICIAR') {return;}
    cerrar();
    if (onConfirm) {onConfirm();}
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {cerrar();}
    if (e.key === 'Enter' && !btnConfirmar.disabled) {onConfirmar();}
  };

  input.addEventListener('input', onInput);
  btnConfirmar.addEventListener('click', onConfirmar);
  btnCancelar.addEventListener('click', cerrar);
  document.addEventListener('keydown', onKeyDown);
}

export function iniciarStatsListado() {
  document.querySelectorAll('.stat-link').forEach((el) => {
    el.addEventListener('click', () => {
      const stat = el.dataset.stat;
      let titulo, items;
      if (stat === 'total') {
        titulo = `Tots els registres (${dom.resTotal.textContent})`;
        items = getTodasUrls();
      } else if (stat === 'dup') {
        mostrarModalMensaje('Duplicats descartats', `Es van descartar ${dom.resDup.textContent} URLs perquè ja existien al sistema durant les importacions. Aquest és un contador històric i no és possible llistar les URLs individuals.`);
        return;
      } else {
        titulo = `Tots els classificats (${dom.resClass.textContent})`;
        items = getTodasUrls();
      }
      mostrarModalListado(titulo, items);
    });
  });
}

function mostrarModalListado(titulo, items) {
  const overlay = document.getElementById('modal-listado');
  const tituloEl = document.getElementById('listado-titulo');
  const contenido = document.getElementById('listado-contenido');
  const cerrar = document.getElementById('btn-listado-cerrar');

  tituloEl.textContent = titulo;
  contenido.innerHTML = '';

  if (items.length === 0) {
    contenido.innerHTML = '<p class="select-prompt">No hi ha elements per mostrar.</p>';
  } else {
    const ul = document.createElement('ul');
    ul.className = 'listado-ul';
    for (const item of items) {
      const li = document.createElement('li');
      if (item.categoria) {
        const cat = document.createElement('span');
        cat.className = 'listado-cat';
        cat.textContent = `[${item.categoria}]`;
        li.appendChild(cat);
      }
      const a = document.createElement('a');
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = item.nombre || item.url;
      li.appendChild(a);
      ul.appendChild(li);
    }
    contenido.appendChild(ul);
  }

  overlay.classList.remove('hidden');

  function cerrarModal() {
    overlay.classList.add('hidden');
    cerrar.removeEventListener('click', cerrarModal);
    document.removeEventListener('keydown', onKeyDown);
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {cerrarModal();}
  };

  cerrar.addEventListener('click', cerrarModal);
  document.addEventListener('keydown', onKeyDown);
  cerrar.focus();
}

export function getCategoriaDeUrl(url) {
  if (!classificationResults) {return null;}
  for (const t of classificationResults.tematicas) {
    if (t.accesos.some((a) => a.url === url)) {return t.nombre;}
  }
  return null;
}

export function obtenerUrlsActuales() {
  if (!classificationResults) {return [];}
  const urls = [];
  for (const t of classificationResults.tematicas) {
    for (const a of t.accesos) {
      urls.push({ url: a.url, nombreArchivo: a.nombreOriginal });
    }
  }
  return urls;
}

// ── Add URL ──

export function obtenerNuevaUrlInput() {
  const url = dom.inputNuevaUrl.value.trim();
  dom.inputNuevaUrl.value = '';
  let categoria = dom.addurlCategoria.value;
  if (categoria === '__NUEVA__') {
    categoria = dom.addurlNuevaCatInput.value.trim().toUpperCase();
    dom.addurlNuevaCatInput.value = '';
  }
  dom.addurlCategoria.value = '';
  dom.addurlNuevaCatContainer.classList.add('hidden');
  return { url, categoria };
}

let addurlChangeHandler = null;

function poblarCategoriasAddUrl() {
  const sel = dom.addurlCategoria;
  if (addurlChangeHandler) {
    sel.removeEventListener('change', addurlChangeHandler);
  }
  sel.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = '';
  auto.textContent = 'Automàtic';
  sel.appendChild(auto);
  if (!classificationResults) {return;}
  for (const t of classificationResults.tematicas) {
    const opt = document.createElement('option');
    opt.value = t.nombre;
    opt.textContent = t.nombre;
    sel.appendChild(opt);
  }
  const sep = document.createElement('option');
  sep.disabled = true;
  sep.textContent = '──────────';
  sel.appendChild(sep);
  const nuevo = document.createElement('option');
  nuevo.value = '__NUEVA__';
  nuevo.textContent = '✚ Nova categoria...';
  sel.appendChild(nuevo);
  sel.value = '';
  addurlChangeHandler = () => {
    if (sel.value === '__NUEVA__') {
      dom.addurlNuevaCatContainer.classList.remove('hidden');
      dom.addurlNuevaCatInput.focus();
    } else {
      dom.addurlNuevaCatContainer.classList.add('hidden');
    }
  };
  sel.addEventListener('change', addurlChangeHandler);
}

export function seleccionarCategoriaPorNombre(nombre) {
  if (!classificationResults) {return;}
  const idx = classificationResults.tematicas.findIndex((t) => t.nombre === nombre);
  if (idx !== -1) {
    seleccionarTema(idx);
  }
}

// ── Reclasificar modal ──

let onReclasificarCallback = null;

export function alReclasificar(callback) {
  onReclasificarCallback = callback;
}

function mostrarModalReclasificar(url, nombreArchivo, desdeCategoria) {
  const overlay = document.getElementById('modal-reclasificar');
  const modalUrl = document.getElementById('modal-url');
  const modalDesde = document.getElementById('modal-desde');
  const modalArchivo = document.getElementById('modal-archivo');
  const selectCat = document.getElementById('modal-categoria');
  const nuevaCatContainer = document.getElementById('modal-nueva-categoria-container');
  const nuevaCatInput = document.getElementById('modal-nueva-categoria');
  const NUEVA_OPCION = '__NUEVA__';

  modalUrl.textContent = url;
  modalDesde.textContent = desdeCategoria;
  modalArchivo.textContent = nombreArchivo || '(desconegut)';

  selectCat.innerHTML = '';
  classificationResults.tematicas.forEach((t) => {
    if (t.nombre === desdeCategoria) {return;}
    const option = document.createElement('option');
    option.value = t.nombre;
    option.textContent = t.nombre;
    selectCat.appendChild(option);
  });

  const sepOption = document.createElement('option');
  sepOption.disabled = true;
  sepOption.textContent = '──────────';
  selectCat.appendChild(sepOption);

  const newOption = document.createElement('option');
  newOption.value = NUEVA_OPCION;
  newOption.textContent = '✚ Nova categoria...';
  selectCat.appendChild(newOption);

  nuevaCatContainer.classList.add('hidden');
  nuevaCatInput.value = '';
  nuevaCatInput.style.borderColor = '';

  function onChangeSelect() {
    if (selectCat.value === NUEVA_OPCION) {
      nuevaCatContainer.classList.remove('hidden');
      nuevaCatInput.focus();
    } else {
      nuevaCatContainer.classList.add('hidden');
    }
  }

  selectCat.addEventListener('change', onChangeSelect);

  overlay.classList.remove('hidden');

  const confirmar = document.getElementById('btn-modal-confirmar');
  const cancelar = document.getElementById('btn-modal-cancelar');

  const onConfirm = () => {
    let hastaCategoria = selectCat.value;
    if (hastaCategoria === NUEVA_OPCION) {
      const nombre = nuevaCatInput.value.trim().toUpperCase();
      if (!nombre) {
        nuevaCatInput.focus();
        nuevaCatInput.style.borderColor = '#dc2626';
        return;
      }
      hastaCategoria = nombre;
    }
    overlay.classList.add('hidden');
    limpiarListeners();
    if (onReclasificarCallback) {
      onReclasificarCallback({ url, nombreArchivo, desdeCategoria, hastaCategoria });
    }
  };

  const onCancel = () => {
    overlay.classList.add('hidden');
    limpiarListeners();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {onCancel();}
  };

  function limpiarListeners() {
    confirmar.removeEventListener('click', onConfirm);
    cancelar.removeEventListener('click', onCancel);
    selectCat.removeEventListener('change', onChangeSelect);
    document.removeEventListener('keydown', onKeyDown);
  }

  confirmar.addEventListener('click', onConfirm);
  cancelar.addEventListener('click', onCancel);
  document.addEventListener('keydown', onKeyDown);
  selectCat.focus();
}

// ── Renombrar categoría ──

let onRenombrarCallback = null;

export function alRenombrar(callback) {
  onRenombrarCallback = callback;
}

function mostrarModalRenombrar(nombreActual) {
  const overlay = document.getElementById('modal-renombrar');
  const renameActual = document.getElementById('rename-actual');
  const renameInput = document.getElementById('rename-nuevo');
  const confirmar = document.getElementById('btn-rename-confirmar');
  const cancelar = document.getElementById('btn-rename-cancelar');

  renameActual.textContent = nombreActual;
  renameInput.value = nombreActual;
  renameInput.style.borderColor = '';
  renameInput.select();

  overlay.classList.remove('hidden');

  const onConfirm = () => {
    const nuevo = renameInput.value.trim().toUpperCase();
    if (!nuevo || nuevo === nombreActual) {
      overlay.classList.add('hidden');
      limpiarListeners();
      return;
    }
    overlay.classList.add('hidden');
    limpiarListeners();
    if (onRenombrarCallback) {
      onRenombrarCallback({ desde: nombreActual, hasta: nuevo });
    }
  };

  const onCancel = () => {
    overlay.classList.add('hidden');
    limpiarListeners();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {onCancel();}
    if (e.key === 'Enter') {onConfirm();}
  };

  function limpiarListeners() {
    confirmar.removeEventListener('click', onConfirm);
    cancelar.removeEventListener('click', onCancel);
    document.removeEventListener('keydown', onKeyDown);
  }

  confirmar.addEventListener('click', onConfirm);
  cancelar.addEventListener('click', onCancel);
  document.addEventListener('keydown', onKeyDown);
  renameInput.focus();
}

// ── Favoritos ──

let onFavoritoCallback = null;
let onQuitarFavoritoCallback = null;

function esFavorito(url) {
  if (!classificationResults) {return false;}
  const fav = classificationResults.tematicas.find((t) => t.nombre === 'FAVORITS');
  return fav ? fav.accesos.some((a) => a.url === url) : false;
}

export function alMarcarFavorito(callback) {
  onFavoritoCallback = callback;
}

export function alQuitarFavorito(callback) {
  onQuitarFavoritoCallback = callback;
}

// ── Editar nombre del marcador ──

let onEditarNombreCallback = null;

export function alEditarNombre(callback) {
  onEditarNombreCallback = callback;
}

function mostrarModalEditarNombre(url, nombreOriginal, nombreActual) {
  const overlay = document.getElementById('modal-editar-nombre');
  const urlSpan = document.getElementById('editname-url');
  const input = document.getElementById('editname-input');
  const confirmar = document.getElementById('btn-editname-confirmar');
  const cancelar = document.getElementById('btn-editname-cancelar');

  urlSpan.textContent = url;
  input.value = nombreActual;
  input.style.borderColor = '';
  input.select();

  overlay.classList.remove('hidden');

  const onConfirm = () => {
    const nuevo = input.value.trim().toUpperCase();
    if (!nuevo || nuevo === nombreActual) {
      overlay.classList.add('hidden');
      limpiarListeners();
      return;
    }
    overlay.classList.add('hidden');
    limpiarListeners();
    if (onEditarNombreCallback) {
      onEditarNombreCallback({ url, nombreOriginal, nuevoNombre: nuevo });
    }
  };

  const onCancel = () => {
    overlay.classList.add('hidden');
    limpiarListeners();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {onCancel();}
    if (e.key === 'Enter') {onConfirm();}
  };

  function limpiarListeners() {
    confirmar.removeEventListener('click', onConfirm);
    cancelar.removeEventListener('click', onCancel);
    document.removeEventListener('keydown', onKeyDown);
  }

  confirmar.addEventListener('click', onConfirm);
  cancelar.addEventListener('click', onCancel);
  document.addEventListener('keydown', onKeyDown);
  input.focus();
}

// ── Eliminar marcador ──

let onEliminarCallback = null;

export function alEliminar(callback) {
  onEliminarCallback = callback;
}

function mostrarModalEliminar(url, nombreArchivo) {
  const overlay = document.getElementById('modal-eliminar');
  const urlSpan = document.getElementById('eliminar-url');
  const confirmar = document.getElementById('btn-eliminar-confirmar');
  const cancelar = document.getElementById('btn-eliminar-cancelar');

  urlSpan.textContent = url;
  overlay.classList.remove('hidden');

  const onConfirm = () => {
    overlay.classList.add('hidden');
    limpiarListeners();
    if (onEliminarCallback) {
      onEliminarCallback({ url, nombreArchivo });
    }
  };

  const onCancel = () => {
    overlay.classList.add('hidden');
    limpiarListeners();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {onCancel();}
  };

  function limpiarListeners() {
    confirmar.removeEventListener('click', onConfirm);
    cancelar.removeEventListener('click', onCancel);
    document.removeEventListener('keydown', onKeyDown);
  }

  confirmar.addEventListener('click', onConfirm);
  cancelar.addEventListener('click', onCancel);
  document.addEventListener('keydown', onKeyDown);
  cancelar.focus();
}
