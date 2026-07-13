import { leerDirectorio, leerArchivosDesdeInput, esCompatible } from './lector.js';
import {
  clasificarEnServidor,
  obtenerClasificacionGuardada,
  reclasificarEnServidor,
  renombrarCategoriaEnServidor,
  eliminarEnServidor,
  editarNombreEnServidor,
  exportarHtml,
  marcarFavoritoEnServidor,
  quitarFavoritoEnServidor,
  reiniciarEnServidor,
} from './api.js';
import {
  iniciarUI,
  mostrarError,
  limpiarError,
  actualizarProgreso,
  ocultarProgreso,
  mostrarPanelStatus,
  habilitarBotonClasificar,
  mostrarCarga,
  mostrarResultados,
  ocultarPanelImportacion,
  exportarResultados,
  configurarPaginacion,
  paginaAnterior,
  paginaSiguiente,
  realizarBusqueda,
  alReclasificar,
  alRenombrar,
  alEditarNombre,
  alEliminar,
  alMarcarFavorito,
  alQuitarFavorito,
  obtenerNuevaUrlInput,
  seleccionarCategoriaPorNombre,
  iniciarStatsListado,
  mostrarModalReiniciar,
  getCategoriaDeUrl,
} from './ui.js';

let parsedShortcuts = [];

function toggleTema() {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('tema', isLight ? 'light' : 'dark');
  const btn = document.getElementById('btn-theme-toggle');
  btn.textContent = isLight ? '🌙' : '☀️';
  document.querySelector('meta[name="theme-color"]').content = isLight ? '#f0f4f8' : '#080c18';
}

document.addEventListener('DOMContentLoaded', async () => {
  iniciarUI();
  iniciarStatsListado();

  const btnReiniciar = document.getElementById('btn-reiniciar');
  btnReiniciar.addEventListener('click', () => {
    mostrarModalReiniciar(async () => {
      mostrarCarga(true, 'Reiniciant dades...');
      try {
        await reiniciarEnServidor();
        location.reload();
      } catch (err) {
        mostrarError(`Error al reiniciar: ${err.message}`);
        mostrarCarga(false);
      }
    });
  });

  const savedTheme = localStorage.getItem('tema')
    || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  }
  const btnToggle = document.getElementById('btn-theme-toggle');
  btnToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';
  document.querySelector('meta[name="theme-color"]').content = savedTheme === 'light' ? '#f0f4f8' : '#080c18';

  btnToggle.addEventListener('click', toggleTema);

  const dropZone = document.getElementById('drop-zone');
  const folderPicker = document.getElementById('folder-picker');
  const btnClassify = document.getElementById('btn-classify');
  const searchThemes = document.getElementById('search-themes');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnExportHtml = document.getElementById('btn-export-html');
  const btnAddUrl = document.getElementById('btn-add-url');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const pageSize = document.getElementById('page-size');

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    await manejarDrop(e.dataTransfer.items);
  });

  dropZone.addEventListener('click', () => {
    folderPicker.click();
  });

  folderPicker.addEventListener('change', async () => {
    if (folderPicker.files.length > 0) {
      await manejarArchivos(folderPicker.files);
      folderPicker.value = '';
    }
  });

  btnClassify.addEventListener('click', async () => {
    await enviarClasificacion();
  });

  searchThemes.addEventListener('input', (e) => {
    realizarBusqueda(e.target.value);
  });

  btnExportJson.addEventListener('click', exportarResultados);

  btnExportHtml.addEventListener('click', async () => {
    try {
      await exportarHtml();
    } catch (err) {
      mostrarError(`Error al exportar HTML: ${err.message}`);
    }
  });

  ['input-nueva-url', 'addurl-categoria', 'addurl-nueva-categoria'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {btnAddUrl.click();}
      });
    }
  });

  btnAddUrl.addEventListener('click', async () => {
    const { url, categoria } = obtenerNuevaUrlInput();
    if (!url) {return;}
    mostrarCarga(true, 'Afegint URL...');
    try {
      limpiarError();
      const nombreArchivo = url;
      let resultados = await clasificarEnServidor([{ url, nombreArchivo }]);
      const desdeCategoria = (() => {
        if (!resultados.tematicas) {return null;}
        for (const t of resultados.tematicas) {
          if (t.accesos.some((a) => a.url === url)) {return t.nombre;}
        }
        return null;
      })();
      if (categoria && categoria !== '' && desdeCategoria && desdeCategoria !== categoria) {
        if (categoria === 'FAVORITS') {
          const favResult = await marcarFavoritoEnServidor(url, nombreArchivo);
          if (favResult) {resultados = favResult;}
        } else {
          resultados = await reclasificarEnServidor(url, nombreArchivo, desdeCategoria, categoria);
        }
      }
      const destino = categoria || desdeCategoria;
      mostrarResultados(resultados, url, destino);
    } catch (err) {
      mostrarError(`Error al afegir URL: ${err.message}`);
    } finally {
      mostrarCarga(false);
    }
  });

  btnPrev.addEventListener('click', paginaAnterior);
  btnNext.addEventListener('click', paginaSiguiente);

  pageSize.addEventListener('change', configurarPaginacion);

  const datosGuardados = await obtenerClasificacionGuardada();
  if (datosGuardados) {
    mostrarResultados(datosGuardados);
  }

  alReclasificar(async ({ url, nombreArchivo, desdeCategoria, hastaCategoria }) => {
    try {
      mostrarCarga(true, 'Actualitzant classificació...');
      const resultados = await reclasificarEnServidor(url, nombreArchivo, desdeCategoria, hastaCategoria);
      mostrarResultados(resultados, url, hastaCategoria);
    } catch (err) {
      mostrarError(`Error al reclassificar: ${err.message}`);
    } finally {
      mostrarCarga(false);
    }
  });

  alRenombrar(async ({ desde, hasta }) => {
    try {
      mostrarCarga(true, 'Renombrant categoria...');
      const resultados = await renombrarCategoriaEnServidor(desde, hasta);
      mostrarResultados(resultados, null, hasta);
    } catch (err) {
      mostrarError(`Error al renombrar: ${err.message}`);
    } finally {
      mostrarCarga(false);
    }
  });

  alEditarNombre(async ({ url, nombreOriginal, nuevoNombre }) => {
    try {
      const categoriaActual = getCategoriaDeUrl(url);
      mostrarCarga(true, 'Guardant nom...');
      const resultados = await editarNombreEnServidor(url, nombreOriginal, nuevoNombre);
      mostrarResultados(resultados, url, categoriaActual);
    } catch (err) {
      mostrarError(`Error al editar nom: ${err.message}`);
    } finally {
      mostrarCarga(false);
    }
  });

  alEliminar(async ({ url, nombreArchivo }) => {
    try {
      const categoriaActual = getCategoriaDeUrl(url);
      mostrarCarga(true, 'Eliminant marcador...');
      const resultados = await eliminarEnServidor(url, nombreArchivo);
      mostrarResultados(resultados, null, categoriaActual);
    } catch (err) {
      mostrarError(`Error al eliminar: ${err.message}`);
    } finally {
      mostrarCarga(false);
    }
  });

  alMarcarFavorito(async ({ url, nombreOriginal }) => {
    try {
      const resultados = await marcarFavoritoEnServidor(url, nombreOriginal);
      if (!resultados) {
        mostrarError('Aquest marcador ja està a Favorits');
        return;
      }
      mostrarResultados(resultados, url, 'FAVORITS');
    } catch (err) {
      mostrarError(`Error al marcar favorit: ${err.message}`);
    }
  });

  alQuitarFavorito(async ({ url }) => {
    try {
      mostrarCarga(true, 'Traient de favorits...');
      const resultados = await quitarFavoritoEnServidor(url);
      mostrarResultados(resultados, url, 'FAVORITS');
    } catch (err) {
      mostrarError(`Error al treure de favorits: ${err.message}`);
    } finally {
      mostrarCarga(false);
    }
  });
});

async function manejarDrop(items) {
  if (!esCompatible()) {
    mostrarError('El teu navegador no suporta la lectura de carpetes. Utilitza Chrome, Edge o Brave.');
    return;
  }

  limpiarError();
  parsedShortcuts = [];
  mostrarPanelStatus(true);
  habilitarBotonClasificar(false);
  mostrarCarga(false);

  try {
    const resultado = await leerDirectorio(items, (progreso) => {
      actualizarProgreso(progreso.leidos, progreso.invalidos);
    });

    parsedShortcuts = resultado.accesos;
    actualizarProgreso(parsedShortcuts.length, resultado.invalidos);
    if (parsedShortcuts.length > 3000) {
      mostrarError(`⚠ Masses fitxers (${parsedShortcuts.length}). El límit és 3000. Elimina'n alguns i torna a intentar-ho.`);
    } else if (parsedShortcuts.length > 0) {
      await enviarClasificacion();
    }
  } catch (err) {
    mostrarError(err.message);
    mostrarPanelStatus(false);
  }
}

async function manejarArchivos(files) {
  limpiarError();
  parsedShortcuts = [];
  mostrarPanelStatus(true);
  habilitarBotonClasificar(false);
  mostrarCarga(false);

  try {
    const resultado = await leerArchivosDesdeInput(files, (progreso) => {
      actualizarProgreso(progreso.leidos, progreso.invalidos);
    });
    parsedShortcuts = resultado.accesos;
    actualizarProgreso(parsedShortcuts.length, resultado.invalidos);
    if (parsedShortcuts.length > 3000) {
      mostrarError(`⚠ Masses fitxers (${parsedShortcuts.length}). El límit és 3000. Elimina'n alguns i torna a intentar-ho.`);
    } else if (parsedShortcuts.length > 0) {
      await enviarClasificacion();
    }
  } catch (err) {
    mostrarError(err.message);
    mostrarPanelStatus(false);
  }
}

async function enviarClasificacion() {
  if (parsedShortcuts.length === 0) {return;}

  mostrarCarga(true, 'El servidor està classificant les teves URLs, si us plau espera...');
  habilitarBotonClasificar(false);

  try {
    const resultados = await clasificarEnServidor(parsedShortcuts);
    ocultarPanelImportacion();
    mostrarResultados(resultados);
  } catch (err) {
    mostrarError(`Error al classificar: ${err.message}`);
    habilitarBotonClasificar(true);
    ocultarProgreso();
  } finally {
    mostrarCarga(false);
  }
}
