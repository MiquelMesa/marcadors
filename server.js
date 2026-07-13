try { require('dotenv/config'); } catch { /* dotenv optional */ }
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');
const logger = require('./logger');
const { obtenerTematica, generarNombreNuevo, validarAccesos, extraerDominio, agregarPalabraClave, agregarCategoria, recargarReglas } = require('./classificador');

const fsSync = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const PUBLIC_PATH = (process.env.PUBLIC_PATH || BASE_PATH || '').replace(/\/+$/, '');
const DATA_FILE = path.join(__dirname, 'datos_clasificados.json');
const REGLAS_FILE = path.join(__dirname, 'reglas.json');
const REGLAS_DEFAULT_FILE = path.join(__dirname, 'reglas.default.json');

// ── index.html con BASE_PATH inyectado ──

let indexHtmlCached = null;

function getIndexHtml() {
  if (indexHtmlCached) {return indexHtmlCached;}
  const raw = fsSync.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  const script = `<script>window.BASE_PATH=${JSON.stringify(PUBLIC_PATH || '/')};</script>`;
  indexHtmlCached = raw.replace('</head>', script + '</head>');
  return indexHtmlCached;
}

// ── sub-app montable ──

const subApp = express.Router();
subApp.use(express.json({ limit: '5mb' }));
subApp.use(express.static(__dirname, { index: false }));

// Main HTML handler
subApp.get('/', (req, res) => {
  res.type('html').send(getIndexHtml());
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Masses peticions. Torna-ho a intentar en un minut.' },
});
subApp.use('/api/', apiLimiter);

// ── helpers ──

function dataVacia() {
  return { urls: [], totalRecibidos: 0, totalDuplicados: 0 };
}

async function leerDatos() {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // migracion desde formato antiguo (con tematicas) a nuevo formato plano
    if (parsed.tematicas && !parsed.urls) {
      const urls = [];
      for (const t of parsed.tematicas) {
        for (const a of t.accesos) {
          urls.push({
            url: a.url,
            nombreOriginal: a.nombreOriginal,
            nombreNuevo: a.nombreNuevo,
            categoria: t.nombre,
          });
        }
      }
      for (const u of urls) {
        u.nombreNuevo = generarNombreNuevo(u.url, u.categoria);
      }
      const migrado = {
        urls,
        totalRecibidos: parsed.totalRecibidos || urls.length,
        totalDuplicados: parsed.totalDuplicados || 0,
      };
      await guardarDatos(migrado);
      return migrado;
    }
    if (!parsed.urls) {return dataVacia();}

    // strip .URL suffix from existing nombres
    let migrado = false;
    for (const u of parsed.urls) {
      if (u.nombreNuevo.endsWith('.URL')) {
        u.nombreNuevo = u.nombreNuevo.slice(0, -4);
        migrado = true;
      }
    }

    // migrar nombres de categoria antiguos español → catalán
    const CAT_MAP = {
      'PARA IA': 'PER A IA',
      'PROGRAMACION': 'PROGRAMACIÓ',
      'FORMACION': 'FORMACIÓ',
      'BASE DE DATOS': 'BASE DE DADES',
      'RECURSOS DISEÑO': 'RECURSOS DISSENY',
      'TRABAJO': 'TREBALL',
      'SOFTWARE Y HERRAMIENTAS': 'SOFTWARE I EINES',
      'NOTICIAS': 'NOTÍCIES',
      'DOCUMENTACION': 'DOCUMENTACIÓ',
      'VIDEOJUEGOS': 'VIDEOJOCS',
      'MUSICA Y AUDIO': 'MÚSICA I ÀUDIO',
      'REDES SOCIALES': 'XARXES SOCIALS',
      'CORRECTORES': 'CORRECTORS',
      'UTILIDADES WEB': 'UTILITATS WEB',
      'LECTURA Y CULTURA': 'LECTURA I CULTURA',
      'LIBROS ELECTRONICOS': 'LLIBRES ELECTRÒNICS',
      'FAVORITOS': 'FAVORITS',
      'CALENDARIOS': 'CALENDARIS',
      'REVISTAS': 'REVISTES',
      'IDIOMAS': 'IDIOMES',
      'VOLUNTARIADO': 'VOLUNTARIAT',
      'APUNTES': 'APUNTS',
      'INTERNET Y RECURSOS VARIOS': 'INTERNET I RECURSOS VARIS',
    };
    for (const u of parsed.urls) {
      const catNueva = CAT_MAP[u.categoria];
      if (catNueva) {
        u.categoria = catNueva;
        migrado = true;
      }
    }
    if (migrado) {
      await guardarDatos(parsed);
    }

    return parsed;
  } catch {
    return dataVacia();
  }
}

async function guardarDatos(data) {
  const tmpFile = DATA_FILE + '.tmp';
  await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  await fs.rename(tmpFile, DATA_FILE);
}

function agruparPorCategoria(data) {
  const map = {};
  for (const u of data.urls) {
    if (!map[u.categoria]) {
      map[u.categoria] = [];
    }
    map[u.categoria].push({
      nombreOriginal: u.nombreOriginal,
      nombreNuevo: u.nombreNuevo,
      url: u.url,
    });
  }
  const tematicas = Object.keys(map)
    .map((nombre) => ({
      nombre,
      accesos: map[nombre].reverse(),
    }))
    .sort((a, b) => {
      if (a.nombre === 'FAVORITS') {return -1;}
      if (b.nombre === 'FAVORITS') {return 1;}
      return a.nombre.localeCompare(b.nombre);
    });
  return tematicas;
}

function construirRespuesta(data) {
  return {
    totalRecibidos: data.totalRecibidos,
    totalDuplicados: data.totalDuplicados,
    totalClasificados: data.urls.length,
    tematicas: agruparPorCategoria(data),
  };
}

// ── endpoints ──

subApp.get('/api/clasificacion-guardada', async (req, res) => {
  try {
    const data = await leerDatos();
    if (data.urls.length === 0) {
      return res.status(404).json({ message: 'No hi ha dades guardades prèviament' });
    }
    res.json(construirRespuesta(data));
  } catch (err) {
    logger.error({ err }, 'Error al llegir dades guardades');
    res.status(500).json({ error: 'Error al llegir dades guardades' });
  }
});

subApp.post('/api/clasificar-url', async (req, res) => {
  const originalList = req.body.accesos;

  if (!validarAccesos(originalList)) {
    return res.status(400).json({
      error: "Dades invàlides. S'esperava un array d'objectes amb 'url' i 'nombreArchivo'.",
    });
  }

  const data = await leerDatos();
  const existingUrls = new Set(data.urls.map((u) => u.url));

  let duplicadosInternos = 0;
  let duplicadosYaExistentes = 0;

  // deduplicar lote actual
  const loteSinDuplicados = [];
  const seen = new Set();
  for (const item of originalList) {
    if (seen.has(item.url)) {
      duplicadosInternos++;
      continue;
    }
    seen.add(item.url);
    if (existingUrls.has(item.url)) {
      duplicadosYaExistentes++;
      continue;
    }
    loteSinDuplicados.push(item);
  }

  const nuevos = [];
  for (const item of loteSinDuplicados) {
    const categoria = obtenerTematica(item.url, item.nombreArchivo);
    const nombreNuevo = generarNombreNuevo(item.url, categoria);
    nuevos.push({
      url: item.url,
      nombreOriginal: item.nombreArchivo,
      nombreNuevo,
      categoria,
    });
  }

  data.urls.push(...nuevos);
  data.totalRecibidos += originalList.length;
  data.totalDuplicados += duplicadosInternos + duplicadosYaExistentes;

  await guardarDatos(data);

  logger.info(
    { nuevos: nuevos.length, duplicadosInternos, duplicadosYaExistentes, total: data.urls.length },
    'Classificació completada'
  );

  res.json(construirRespuesta(data));
});

subApp.post('/api/reclasificar', async (req, res) => {
  const { url, nombreArchivo, desdeCategoria, hastaCategoria } = req.body;

  if (!url || !desdeCategoria || !hastaCategoria) {
    return res.status(400).json({ error: 'Falten dades requerides (url, desdeCategoria, hastaCategoria)' });
  }

  try {
    const dominio = extraerDominio(url);
    if (dominio) {
      const catCreada = agregarCategoria(hastaCategoria, dominio, 3);
      if (!catCreada) {
        agregarPalabraClave(hastaCategoria, dominio, 3);
      }
    }

    const data = await leerDatos();
    const idx = data.urls.findIndex((u) => u.url === url);

    if (idx === -1) {
      return res.status(404).json({ error: 'URL no trobada a les dades guardades' });
    }

    const [item] = data.urls.splice(idx, 1);
    item.categoria = hastaCategoria;
    item.nombreNuevo = generarNombreNuevo(url, hastaCategoria);
    if (nombreArchivo) {
      item.nombreOriginal = nombreArchivo;
    }
    data.urls.push(item);

    await guardarDatos(data);
    recargarReglas();

    logger.info({ url, desde: desdeCategoria, hasta: hastaCategoria, dominio }, 'URL reclassificada');

    res.json(construirRespuesta(data));
  } catch (err) {
    logger.error({ err }, 'Error al reclassificar URL');
    res.status(500).json({ error: 'Error intern en reclassificar', ...(process.env.NODE_ENV === 'development' && { detalle: err.message }) });
  }
});

subApp.post('/api/marcar-favorito', async (req, res) => {
  const { url, nombreOriginal } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Falta la URL' });
  }
  try {
    const data = await leerDatos();
    const yaExiste = data.urls.some((u) => u.url === url && u.categoria === 'FAVORITS');
    if (yaExiste) {
      return res.status(409).json({ error: 'Ja està a favorits' });
    }

    // ensure FAVORITOS exists in reglas
    const reglasRaw = fsSync.readFileSync(REGLAS_FILE, 'utf-8');
    const reglas = JSON.parse(reglasRaw);
    if (!reglas.some((r) => r.categoria === 'FAVORITS')) {
      reglas.push({ categoria: 'FAVORITS', keywords: [] });
      fsSync.writeFileSync(REGLAS_FILE, JSON.stringify(reglas, null, 2), 'utf-8');
      recargarReglas();
    }

    const existente = data.urls.find((u) => u.url === url && u.categoria !== 'FAVORITS');
    const nombreNuevo = existente ? existente.nombreNuevo : generarNombreNuevo(url, 'FAVORITS');
    data.urls.push({ url, nombreOriginal: nombreOriginal || url, nombreNuevo, categoria: 'FAVORITS' });
    await guardarDatos(data);

    logger.info({ url }, 'Marcat com a favorit');
    res.json(construirRespuesta(data));
  } catch (err) {
    logger.error({ err }, 'Error al marcar favorit');
    res.status(500).json({ error: 'Error intern en marcar favorit' });
  }
});

subApp.post('/api/quitar-favorito', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Falta la URL' });
  }
  try {
    const data = await leerDatos();
    const favIdx = data.urls.findIndex((u) => u.url === url && u.categoria === 'FAVORITS');
    if (favIdx === -1) {
      return res.status(404).json({ error: 'URL no trobada a favorits' });
    }
    const soloFav = !data.urls.some((u) => u.url === url && u.categoria !== 'FAVORITS');
    if (soloFav) {
      // re-clasificar automaticamente antes de quitar de favoritos
      const nombreOriginal = data.urls[favIdx].nombreOriginal;
      const categoria = obtenerTematica(url, nombreOriginal);
      const nombreNuevo = generarNombreNuevo(url, categoria);
      data.urls.push({ url, nombreOriginal, nombreNuevo, categoria });
    }
    data.urls.splice(favIdx, 1);
    await guardarDatos(data);
    logger.info({ url, soloFav }, 'Tret de favorits');
    res.json(construirRespuesta(data));
  } catch (err) {
    logger.error({ err }, 'Error al treure favorit');
    res.status(500).json({ error: 'Error intern en treure favorit' });
  }
});

subApp.post('/api/renombrar-categoria', async (req, res) => {
  const { desde, hasta } = req.body;

  if (!desde || !hasta) {
    return res.status(400).json({ error: 'Falten dades requerides (desde, hasta)' });
  }

  try {
    const data = await leerDatos();
    for (const u of data.urls) {
      if (u.categoria === desde) {
        u.categoria = hasta;
        u.nombreNuevo = generarNombreNuevo(u.url, hasta);
      }
    }
    await guardarDatos(data);

    const reglasRaw = fsSync.readFileSync(REGLAS_FILE, 'utf-8');
    const reglas = JSON.parse(reglasRaw);
    const regla = reglas.find((r) => r.categoria === desde);
    if (regla) {
      regla.categoria = hasta;
      fsSync.writeFileSync(REGLAS_FILE, JSON.stringify(reglas, null, 2), 'utf-8');
    }

    recargarReglas();

    logger.info({ desde, hasta }, 'Categoria renombrada');

    res.json(construirRespuesta(data));
  } catch (err) {
    logger.error({ err }, 'Error en renombrar categoria');
    res.status(500).json({ error: 'Error en renombrar categoria', ...(process.env.NODE_ENV === 'development' && { detalle: err.message }) });
  }
});

subApp.delete('/api/eliminar', async (req, res) => {
  const { url, nombreArchivo } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Falta la URL' });
  }
  try {
    const data = await leerDatos();
    const idx = data.urls.findIndex((u) => u.url === url && (!nombreArchivo || u.nombreOriginal === nombreArchivo));
    if (idx === -1) {
      return res.status(404).json({ error: 'URL no trobada' });
    }
    const [removido] = data.urls.splice(idx, 1);
    await guardarDatos(data);
    logger.info({ url: removido.url, categoria: removido.categoria }, 'URL eliminada');
    res.json(construirRespuesta(data));
  } catch (err) {
    logger.error({ err }, 'Error al eliminar URL');
    res.status(500).json({ error: 'Error intern en eliminar' });
  }
});

subApp.put('/api/editar-nombre', async (req, res) => {
  const { url, nombreOriginal, nuevoNombre } = req.body;
  if (!url || !nuevoNombre) {
    return res.status(400).json({ error: 'Faltan datos (url, nuevoNombre)' });
  }
  try {
    const data = await leerDatos();
    const idx = data.urls.findIndex((u) => u.url === url && u.nombreOriginal === nombreOriginal);
    if (idx === -1) {
      return res.status(404).json({ error: 'URL no trobada' });
    }
    data.urls[idx].nombreNuevo = nuevoNombre.trim();
    await guardarDatos(data);
    logger.info({ url, nombreAnterior: data.urls[idx].nombreOriginal, nuevoNombre }, 'Nombre editado');
    res.json(construirRespuesta(data));
  } catch (err) {
    logger.error({ err }, 'Error al editar nombre');
    res.status(500).json({ error: 'Error intern en editar nom' });
  }
});

subApp.get('/api/exportar-html', async (req, res) => {
  try {
    const data = await leerDatos();
    const grupos = agruparPorCategoria(data);
    const lines = [];
    lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
    lines.push('<TITLE>Marcadors</TITLE>');
    lines.push('<H1>Marcadors</H1>');
    lines.push('<DL><p>');
    for (const g of grupos) {
      lines.push(`    <DT><H3>${g.nombre}</H3>`);
      lines.push('    <DL><p>');
      for (const a of g.accesos) {
        lines.push(`        <DT><A HREF="${a.url}" ADD_DATE="${Math.floor(Date.now() / 1000)}">${a.nombreNuevo}</A>`);
      }
      lines.push('    </DL><p>');
    }
    lines.push('</DL><p>');
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Content-Disposition', `attachment; filename="marcadors_${new Date().toISOString().slice(0, 10)}.html"`);
    res.send(lines.join('\n'));
  } catch (err) {
    logger.error({ err }, 'Error al exportar HTML');
    res.status(500).json({ error: 'Error intern en exportar' });
  }
});

// ── reiniciar ──

subApp.post('/api/reiniciar', async (req, res) => {
  try {
    await guardarDatos({ urls: [], totalRecibidos: 0, totalDuplicados: 0 });

    const defaultRaw = await fs.readFile(REGLAS_DEFAULT_FILE, 'utf-8');
    await fs.writeFile(REGLAS_FILE, defaultRaw, 'utf-8');
    recargarReglas();

    logger.info('Dades reiniciades a estat inicial');
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, 'Error al reiniciar');
    res.status(500).json({ error: 'Error en reiniciar les dades' });
  }
});

// ── error handler ──

subApp.use((err, req, res, _next) => {
  logger.error({ err, url: req.url, method: req.method }, 'Error no manejado');
  res.status(err.statusCode || err.status || 500).json({
    error: 'Error intern del servidor',
    ...(process.env.NODE_ENV === 'development' && { detalle: err.message }),
  });
});

async function guardarDefaultSiNoExiste() {
  try {
    await fs.access(REGLAS_DEFAULT_FILE);
  } catch {
    const raw = await fs.readFile(REGLAS_FILE, 'utf-8');
    await fs.writeFile(REGLAS_DEFAULT_FILE, raw, 'utf-8');
    logger.info('Snapshot de regles guardat com a regles.default.json');
  }
}

// ── montar sub-app en BASE_PATH ──

app.use(BASE_PATH || '/', subApp);

guardarDefaultSiNoExiste().catch((err) => {
  logger.error({ err }, 'Error al guardar snapshot de reglas por defecto');
}).then(() => {
  app.listen(PORT, () => {
    const url = `http://localhost:${PORT}${BASE_PATH}/`;
    logger.info({ port: PORT, basePath: BASE_PATH || '/', url }, 'Servidor iniciat');
  });
});
