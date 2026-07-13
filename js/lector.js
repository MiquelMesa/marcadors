export function esCompatible() {
  return (
    typeof DataTransferItem !== 'undefined' &&
    typeof DataTransferItem.prototype.webkitGetAsEntry === 'function'
  );
}

export async function leerArchivosDesdeInput(files, onProgress) {
  const state = { accesos: [], invalidos: 0 };
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = file.name.toLowerCase();
    if (name.endsWith('.url')) {
      try {
        const content = await leerArchivo(file);
        const url = extraerUrl(content);
        if (url && esUrlValida(url)) {
          state.accesos.push({ nombreArchivo: file.name, url, rutaRelativa: file.webkitRelativePath || file.name });
        } else {
          state.invalidos++;
        }
      } catch {
        state.invalidos++;
      }
    } else if (name.endsWith('.html') || name.endsWith('.htm')) {
      try {
        const content = await leerArchivo(file);
        const marcadores = extraerMarcadores(content);
        for (const m of marcadores) {
          state.accesos.push({ nombreArchivo: m.titulo, url: m.url, rutaRelativa: file.webkitRelativePath || file.name });
        }
        if (marcadores.length === 0) {state.invalidos++;}
      } catch {
        state.invalidos++;
      }
    } else {
      state.invalidos++;
    }
    if (onProgress) {onProgress({ leidos: state.accesos.length, invalidos: state.invalidos });}
  }
  return { accesos: state.accesos, invalidos: state.invalidos };
}

export async function leerDirectorio(items, onProgress) {
  const fileEntries = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry();
      if (entry) {fileEntries.push(entry);}
    }
  }

  if (fileEntries.length === 0) {
    throw new Error('No s\'han trobat fitxers. Arrossega una carpeta o un fitxer de marcadors HTML.');
  }

  const state = { accesos: [], invalidos: 0 };

  for (const entry of fileEntries) {
    await procesarEntrada(entry, state, onProgress);
    if ((state.accesos.length + state.invalidos) % 5 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return { accesos: state.accesos, invalidos: state.invalidos };
}

async function procesarEntrada(entry, state, onProgress) {
  if (entry.isFile) {
    const name = entry.name.toLowerCase();
    if (name.endsWith('.url')) {
      try {
        const file = await entryToFile(entry);
        const content = await leerArchivo(file);
        const url = extraerUrl(content);
        if (url && esUrlValida(url)) {
          state.accesos.push({
            nombreArchivo: entry.name,
            url: url,
            rutaRelativa: entry.fullPath || entry.name,
          });
        } else {
          state.invalidos++;
        }
      } catch {
        state.invalidos++;
      }
    } else if (name.endsWith('.html') || name.endsWith('.htm')) {
      try {
        const file = await entryToFile(entry);
        const content = await leerArchivo(file);
        const marcadores = extraerMarcadores(content);
        for (const m of marcadores) {
          state.accesos.push({
            nombreArchivo: m.titulo,
            url: m.url,
            rutaRelativa: entry.fullPath || entry.name,
          });
        }
        if (marcadores.length === 0) {
          state.invalidos++;
        }
      } catch {
        state.invalidos++;
      }
    } else {
      state.invalidos++;
    }
    if (onProgress) {
      onProgress({ leidos: state.accesos.length, invalidos: state.invalidos });
    }
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const entries = await leerTodasLasEntradas(dirReader);
    for (const subEntry of entries) {
      await procesarEntrada(subEntry, state, onProgress);
    }
  }
}

function entryToFile(fileEntry) {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function leerTodasLasEntradas(dirReader) {
  let allEntries = [];
  let chunk;
  do {
    chunk = await leerChunk(dirReader);
    allEntries = allEntries.concat(chunk);
  } while (chunk.length > 0);
  return allEntries;
}

function leerChunk(dirReader) {
  return new Promise((resolve, reject) => {
    dirReader.readEntries(resolve, reject);
  });
}

function extraerUrl(texto) {
  const lines = texto.split(/\r?\n/);
  for (const line of lines) {
    const match = line.trim().match(/^URL\s*=\s*(.+)$/i);
    if (match) {return match[1].trim();}
  }
  return null;
}

function esUrlValida(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extraerMarcadores(html) {
  const marcadores = [];
  const regex = /<A\s+HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const url = match[1].trim();
    const titulo = match[2].trim() || 'Marcador';
    if (esUrlValida(url)) {
      marcadores.push({ url, titulo });
    }
  }
  return marcadores;
}
