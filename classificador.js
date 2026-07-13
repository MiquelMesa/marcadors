const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const REGLAS_FILE = path.join(__dirname, 'reglas.json');
const DEFAULT_CATEGORIA = 'INTERNET I RECURSOS VARIS';
let reglasCache = null;

if (process.env.NODE_ENV !== 'test') {
  fs.watchFile(REGLAS_FILE, { interval: 2000 }, () => {
    if (reglasCache) {
      reglasCache = null;
      logger.info('reglas.json changed, cache invalidated');
    }
  });
}

function cargarReglas() {
  if (reglasCache) {return reglasCache;}
  try {
    const data = fs.readFileSync(REGLAS_FILE, 'utf-8');
    reglasCache = JSON.parse(data);
    logger.info({ categorias: reglasCache.length }, 'Regles de classificació carregades');
    return reglasCache;
  } catch (err) {
    logger.error({ err }, 'Error en carregar regles.json');
    return [];
  }
}

function recargarReglas() {
  reglasCache = null;
  return cargarReglas();
}

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function obtenerTematica(url, nombreArchivo) {
  const textoBusqueda = normalizarTexto(`${url} ${nombreArchivo}`);
  const reglas = cargarReglas();

  let mejorCategoria = DEFAULT_CATEGORIA;
  let mejorPuntaje = 0;

  for (const regla of reglas) {
    let puntaje = 0;
    for (const kw of regla.keywords) {
      const kwNormalizada = normalizarTexto(kw.texto);
      const peso = kw.peso || 1;
      const regex = new RegExp(`\\b${kwNormalizada}\\b`, 'i');
      if (regex.test(textoBusqueda)) {
        puntaje += peso;
      }
    }

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejorCategoria = regla.categoria;
    }
  }

  return mejorCategoria;
}

function generarNombreNuevo(url, categoria) {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.replace('www.', '');
    const partes = host.split('.');
    const dominioPrincipal = partes.length >= 2 ? partes[partes.length - 2] : partes[0];
    let base = dominioPrincipal
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s-]/g, '')
      .trim();
    if (!base) {base = 'ACCESO';}
    return `${base} - ${categoria}`.toUpperCase();
  } catch {
    return 'ACCESO DIRECTO CLASIFICADO';
  }
}

function validarAccesos(lista) {
  if (!Array.isArray(lista)) {return false;}
  return lista.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.url === 'string' &&
      item.url.startsWith('http') &&
      typeof item.nombreArchivo === 'string'
  );
}

function extraerDominio(url) {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.replace('www.', '');
    const partes = host.split('.');
    return partes.length >= 2 ? partes[partes.length - 2] : partes[0];
  } catch {
    return null;
  }
}

function guardarReglas(reglas) {
  try {
    fs.writeFileSync(REGLAS_FILE, JSON.stringify(reglas, null, 2), 'utf-8');
    reglasCache = reglas;
    logger.info({ categorias: reglas.length }, 'Regles de classificació guardades');
    return true;
  } catch (err) {
    logger.error({ err }, 'Error en guardar regles.json');
    return false;
  }
}

function agregarPalabraClave(categoria, texto, peso) {
  const reglas = cargarReglas();
  const cat = reglas.find((r) => r.categoria === categoria);
  if (!cat) {return false;}
  const yaExiste = cat.keywords.some((k) => k.texto.toLowerCase() === texto.toLowerCase());
  if (yaExiste) {return false;}
  cat.keywords.push({ texto, peso: peso || 3 });
  return guardarReglas(reglas);
}

function agregarCategoria(nombre, keywordTexto, keywordPeso) {
  const reglas = cargarReglas();
  const existe = reglas.some((r) => r.categoria === nombre);
  if (existe) {return false;}
  reglas.push({
    categoria: nombre,
    keywords: [{ texto: keywordTexto, peso: keywordPeso || 3 }],
  });
  return guardarReglas(reglas);
}

module.exports = {
  obtenerTematica,
  generarNombreNuevo,
  validarAccesos,
  cargarReglas,
  recargarReglas,
  extraerDominio,
  guardarReglas,
  agregarPalabraClave,
  agregarCategoria,
};
