function apiUrl(path) {
  const base = window.BASE_PATH || '';
  const cleanBase = base.endsWith('/') && path.startsWith('/') ? base.slice(0, -1) : base;
  return cleanBase + path;
}

export async function clasificarEnServidor(accesos) {
  const response = await fetch(apiUrl('/api/clasificar-url'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accesos }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error del servidor: ${response.status}`);
  }

  return await response.json();
}

export async function renombrarCategoriaEnServidor(desde, hasta) {
  const response = await fetch(apiUrl('/api/renombrar-categoria'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ desde, hasta }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error del servidor: ${response.status}`);
  }
  return await response.json();
}

export async function obtenerClasificacionGuardada() {
  try {
    const response = await fetch(apiUrl('/api/clasificacion-guardada'));
    if (response.ok) {return await response.json();}
    return null;
  } catch {
    return null;
  }
}

export async function reclasificarEnServidor(url, nombreArchivo, desdeCategoria, hastaCategoria) {
  const response = await fetch(apiUrl('/api/reclasificar'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, nombreArchivo, desdeCategoria, hastaCategoria }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error del servidor: ${response.status}`);
  }

  return await response.json();
}

export async function eliminarEnServidor(url, nombreArchivo) {
  const response = await fetch(apiUrl('/api/eliminar'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, nombreArchivo }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error del servidor: ${response.status}`);
  }
  return await response.json();
}

export async function editarNombreEnServidor(url, nombreOriginal, nuevoNombre) {
  const response = await fetch(apiUrl('/api/editar-nombre'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, nombreOriginal, nuevoNombre }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error del servidor: ${response.status}`);
  }
  return await response.json();
}

export async function exportarHtml() {
  const response = await fetch(apiUrl('/api/exportar-html'));
  if (!response.ok) {throw new Error('Error al exportar HTML');}
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `marcadors_${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function marcarFavoritoEnServidor(url, nombreOriginal) {
  const response = await fetch(apiUrl('/api/marcar-favorito'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, nombreOriginal }),
  });
  if (!response.ok) {
    if (response.status === 409) {return null;}
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error del servidor: ${response.status}`);
  }
  return await response.json();
}

export async function reiniciarEnServidor() {
  const response = await fetch(apiUrl('/api/reiniciar'), { method: 'POST' });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error del servidor: ${response.status}`);
  }
  return await response.json();
}

export async function quitarFavoritoEnServidor(url) {
  const response = await fetch(apiUrl('/api/quitar-favorito'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Error del servidor: ${response.status}`);
  }
  return await response.json();
}
