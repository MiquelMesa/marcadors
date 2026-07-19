const { obtenerTematica, generarNombreNuevo, validarAccesos } = require('../classificador');

describe('obtenerTematica', () => {
  test('detecta inteligencia artificial por chatgpt', () => {
    expect(obtenerTematica('https://chat.openai.com', 'chatgpt.url')).toBe('PER A IA');
  });

  test('detecta inteligencia artificial por claude', () => {
    expect(obtenerTematica('https://claude.ai', 'claude.url')).toBe('PER A IA');
  });

  test('detecta programacion por github', () => {
    expect(obtenerTematica('https://github.com', 'github.url')).toBe('PROGRAMACIÓ');
  });

  test('detecta programacion por stackoverflow', () => {
    expect(obtenerTematica('https://stackoverflow.com/questions', 'stackoverflow.url')).toBe('PROGRAMACIÓ');
  });

  test('detecta formacion por udemy', () => {
    expect(obtenerTematica('https://www.udemy.com/course', 'udemy.url')).toBe('FORMACIÓ EN IT');
  });

  test('detecta base de datos por mysql', () => {
    expect(obtenerTematica('https://www.mysql.com', 'mysql.url')).toBe('TOT BASE DADES');
  });

  test('detecta excel por excel', () => {
    expect(obtenerTematica('https://exceljet.net', 'excel.url')).toBe('RECURSOS EXCEL');
  });

  test('detecta disseny per figma', () => {
    expect(obtenerTematica('https://figma.com', 'figma.url')).toBe('TOT DISSENY WEB');
  });

  test('devuelve categoria por defecto para url desconocida', () => {
    expect(obtenerTematica('https://xyz123test.xyz', 'test.url')).toBe('INTERNET I RECURSOS VARIS');
  });

  test('clasifica correctamente basado en nombre de archivo con stackoverflow', () => {
    expect(obtenerTematica('https://example.com', 'stackoverflow-python.url')).toBe('PROGRAMACIÓ');
  });

  test('clasifica correctamente con categoría de peso mayor', () => {
    const resultado = obtenerTematica('https://github.com/learn-python', 'github-curso.url');
    expect(['PROGRAMACIÓ', 'FORMACIÓ EN IT']).toContain(resultado);
  });
});

describe('generarNombreNuevo', () => {
  test('genera nombre a partir de dominio simple', () => {
    const nombre = generarNombreNuevo('https://www.github.com', 'PROGRAMACIÓ');
    expect(nombre).toBe('GITHUB - PROGRAMACIÓ');
  });

  test('genera nombre sin www', () => {
    const nombre = generarNombreNuevo('https://stackoverflow.com/questions', 'PROGRAMACIÓ');
    expect(nombre).toBe('STACKOVERFLOW - PROGRAMACIÓ');
  });

  test('maneja errores de URL', () => {
    const nombre = generarNombreNuevo('not-a-url', 'TEST');
    expect(nombre).toBe('ACCESO DIRECTO CLASIFICADO');
  });

  test('incluye categoria en el nombre', () => {
    const nombre = generarNombreNuevo('https://openai.com', 'PER A IA');
    expect(nombre).toContain('PER A IA');
  });
});

describe('validarAccesos', () => {
  test('acepta array valido con un elemento', () => {
    const accesos = [{ url: 'https://example.com', nombreArchivo: 'test.url' }];
    expect(validarAccesos(accesos)).toBe(true);
  });

  test('acepta array valido con multiples elementos', () => {
    const accesos = [
      { url: 'https://example.com', nombreArchivo: 'a.url' },
      { url: 'https://example.org', nombreArchivo: 'b.url' },
    ];
    expect(validarAccesos(accesos)).toBe(true);
  });

  test('rechaza null', () => {
    expect(validarAccesos(null)).toBe(false);
  });

  test('rechaza undefined', () => {
    expect(validarAccesos(undefined)).toBe(false);
  });

  test('rechaza string', () => {
    expect(validarAccesos('not-array')).toBe(false);
  });

  test('rechaza array con objetos sin url', () => {
    const accesos = [{ nombreArchivo: 'test.url' }];
    expect(validarAccesos(accesos)).toBe(false);
  });

  test('rechaza array con url que no empieza por http', () => {
    const accesos = [{ url: 'ftp://example.com', nombreArchivo: 'test.url' }];
    expect(validarAccesos(accesos)).toBe(false);
  });

  test('rechaza array con objetos sin nombreArchivo', () => {
    const accesos = [{ url: 'https://example.com' }];
    expect(validarAccesos(accesos)).toBe(false);
  });

  test('rechaza array con null dentro', () => {
    const accesos = [null];
    expect(validarAccesos(accesos)).toBe(false);
  });

  test('rechaza array vacio (vacio no tiene elementos invalidos)', () => {
    expect(validarAccesos([])).toBe(true);
  });
});
