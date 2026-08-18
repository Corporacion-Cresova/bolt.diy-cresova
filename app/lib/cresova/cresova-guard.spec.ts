import { describe, expect, it } from 'vitest';
import { detectBuildIntent, stripMessageMetadata } from './build-intent';
import { isDevServerCommand } from './dev-server';

describe('detectBuildIntent', () => {
  it('detects Spanish build requests', () => {
    expect(detectBuildIntent('Crea una página web profesional para una empresa de limpieza')).toBe(true);
    expect(detectBuildIntent('Hazme una landing page para Premier Cleaning Service')).toBe(true);
    expect(detectBuildIntent('Necesito una web pro para mi taller mecánico')).toBe(true);
  });

  it('detects English build requests', () => {
    expect(detectBuildIntent('Build a landing page for a cleaning company')).toBe(true);
    expect(detectBuildIntent('create a portfolio website')).toBe(true);
  });

  it('ignores questions', () => {
    expect(detectBuildIntent('¿Cuál es la diferencia entre React y Vue?')).toBe(false);
    expect(detectBuildIntent('What is the difference between React and Vue?')).toBe(false);
    expect(detectBuildIntent('¿Cómo funciona useEffect?')).toBe(false);
  });

  it('ignores the model/provider prefix injected by the chat', () => {
    expect(stripMessageMetadata('[Model: qwen]\n\n[Provider: OpenRouter]\n\nHola')).toBe('Hola');
    expect(detectBuildIntent('[Model: qwen]\n\n[Provider: OpenRouter]\n\nCrea un sitio web')).toBe(true);
  });
});

describe('isDevServerCommand', () => {
  it('recognises long running server commands', () => {
    expect(isDevServerCommand('npm run dev')).toBe(true);
    expect(isDevServerCommand('pnpm dev')).toBe(true);
    expect(isDevServerCommand('npm install && npm run dev')).toBe(true);
    expect(isDevServerCommand('npm start')).toBe(true);
    expect(isDevServerCommand('npx --yes serve')).toBe(true);
    expect(isDevServerCommand('vite')).toBe(true);
    expect(isDevServerCommand('next dev')).toBe(true);
  });

  it('leaves one-off commands as blocking shell commands', () => {
    expect(isDevServerCommand('npm install')).toBe(false);
    expect(isDevServerCommand('npm run build')).toBe(false);
    expect(isDevServerCommand('vite build')).toBe(false);
    expect(isDevServerCommand('mkdir src')).toBe(false);
    expect(isDevServerCommand('')).toBe(false);
  });
});
