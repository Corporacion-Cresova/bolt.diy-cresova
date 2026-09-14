import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __olvidarOrigenes, comprobarOrigenServible, origenServible } from './servable-origin';

const responde = (status: number) => vi.fn(async () => new Response('', { status })) as unknown as typeof fetch;

describe('comprobarOrigenServible', () => {
  it('rechaza un origen http, que es contenido mixto en la página del cliente', async () => {
    const resultado = await comprobarOrigenServible('http://builder.cresova.com', responde(404));

    expect(resultado.servible).toBe(false);
    expect(resultado.motivo).toMatch(/X-Forwarded-Proto/);
  });

  it('deja pasar http en desarrollo local, donde no hay página https que proteger', async () => {
    await expect(comprobarOrigenServible('http://localhost:5173', responde(404))).resolves.toMatchObject({
      servible: true,
    });
  });

  it('rechaza cuando el proxy pide autenticación', async () => {
    /*
     * El caso real: builder.cresova.com está detrás de la autenticación básica de Traefik, así que
     * la foto contesta 401 a cualquiera que no sea Diego. El sitio del cliente no tiene la
     * contraseña y no debería tenerla.
     */
    for (const status of [401, 403]) {
      const resultado = await comprobarOrigenServible('https://builder.cresova.com', responde(status));

      expect(resultado.servible, `status ${status}`).toBe(false);
      expect(resultado.motivo).toMatch(/autenticación básica/);
    }
  });

  it('acepta un 404, que es la app contestando que la sonda no existe', async () => {
    await expect(comprobarOrigenServible('https://builder.cresova.com', responde(404))).resolves.toMatchObject({
      servible: true,
    });
  });

  it('ante una falla de red asume que sí, para no inventar motivos de no gastar', async () => {
    const rota = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    }) as unknown as typeof fetch;

    await expect(comprobarOrigenServible('https://builder.cresova.com', rota)).resolves.toMatchObject({
      servible: true,
    });
  });

  it('pregunta por la ruta de las imágenes y no por otra', async () => {
    const espia = responde(404);
    await comprobarOrigenServible('https://builder.cresova.com', espia);

    expect(espia).toHaveBeenCalledWith(expect.stringContaining('/api/cresova-image/'), expect.anything());
  });
});

describe('origenServible', () => {
  beforeEach(__olvidarOrigenes);

  it('pregunta una sola vez por origen', async () => {
    const espia = responde(404);

    await Promise.all([
      origenServible('https://builder.cresova.com', espia),
      origenServible('https://builder.cresova.com', espia),
      origenServible('https://builder.cresova.com', espia),
    ]);

    expect(espia).toHaveBeenCalledTimes(1);
  });
});
