import { describe, expect, it } from 'vitest';
import { publicOrigin } from './public-origin';

const pedido = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe('publicOrigin', () => {
  it('usa el esquema que reporta el proxy, no el que ve el contenedor', () => {
    /*
     * El caso real: Traefik termina el TLS y le pasa http al contenedor. Sin esto, las fotos
     * generadas salían con URL http dentro de una página https y el navegador las bloqueaba.
     */
    expect(publicOrigin(pedido('http://builder.cresova.com/api/chat', { 'x-forwarded-proto': 'https' }))).toBe(
      'https://builder.cresova.com',
    );
  });

  it('toma el primero cuando hay proxies encadenados', () => {
    expect(publicOrigin(pedido('http://builder.cresova.com/', { 'x-forwarded-proto': 'https, http' }))).toBe(
      'https://builder.cresova.com',
    );
  });

  it('entiende el header estándar Forwarded', () => {
    expect(publicOrigin(pedido('http://builder.cresova.com/', { forwarded: 'for=1.2.3.4;proto=https;by=x' }))).toBe(
      'https://builder.cresova.com',
    );
  });

  it('respeta el host que reporta el proxy', () => {
    expect(
      publicOrigin(
        pedido('http://10.0.1.4:5173/', { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'builder.cresova.com' }),
      ),
    ).toBe('https://builder.cresova.com');
  });

  it('sin headers de proxy deja la URL como está', () => {
    expect(publicOrigin(pedido('http://localhost:5173/api/chat'))).toBe('http://localhost:5173');
    expect(publicOrigin(pedido('https://builder.cresova.com/api/chat'))).toBe('https://builder.cresova.com');
  });

  it('ignora un esquema que no es http ni https', () => {
    /*
     * Un valor cualquiera en un header que llega de afuera no puede terminar dentro de una URL que
     * después se pega en el código del cliente.
     */
    expect(publicOrigin(pedido('https://builder.cresova.com/', { 'x-forwarded-proto': 'javascript' }))).toBe(
      'https://builder.cresova.com',
    );
  });
});
