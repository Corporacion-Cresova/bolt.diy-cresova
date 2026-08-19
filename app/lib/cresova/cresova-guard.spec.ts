import { describe, expect, it } from 'vitest';
import { detectBuildIntent, stripMessageMetadata } from './build-intent';
import { isDevServerCommand } from './dev-server';
import {
  DEFAULT_COMMAND_TIMEOUT_MS,
  ensureNonInteractiveFlags,
  getCommandTimeout,
  LONG_COMMAND_TIMEOUT_MS,
  makeCommandNonInteractive,
} from './shell-watchdog';

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

describe('getCommandTimeout', () => {
  it('gives installs and builds a long budget', () => {
    expect(getCommandTimeout('npm install')).toBe(LONG_COMMAND_TIMEOUT_MS);
    expect(getCommandTimeout('npx update-browserslist-db@latest && npm install')).toBe(LONG_COMMAND_TIMEOUT_MS);
    expect(getCommandTimeout('npm run build')).toBe(LONG_COMMAND_TIMEOUT_MS);
  });

  it('keeps everyday commands on the short budget', () => {
    expect(getCommandTimeout('mkdir src')).toBe(DEFAULT_COMMAND_TIMEOUT_MS);
    expect(getCommandTimeout('ls -la')).toBe(DEFAULT_COMMAND_TIMEOUT_MS);
  });
});

describe('ensureNonInteractiveFlags', () => {
  it('stops npx and npm init from asking for confirmation', () => {
    expect(ensureNonInteractiveFlags('npx shadcn@latest init')).toBe('npx --yes shadcn@latest init');
    expect(ensureNonInteractiveFlags('npm init vite')).toBe('npm init --yes vite');
  });

  it('does not duplicate a flag that is already there', () => {
    expect(ensureNonInteractiveFlags('npx --yes serve')).toBe('npx --yes serve');
    expect(ensureNonInteractiveFlags('npx -y serve')).toBe('npx -y serve');
  });

  it('leaves unrelated commands untouched', () => {
    expect(ensureNonInteractiveFlags('npm install')).toBe('npm install');
  });

  it('adds a non-interactive environment for one-off commands', () => {
    expect(makeCommandNonInteractive('npm install')).toBe('export CI=true FORCE_COLOR=0 && npm install');
  });

  it('does not stack a second environment prefix', () => {
    const alreadyHardened = 'export CI=true DEBIAN_FRONTEND=noninteractive FORCE_COLOR=0 && npm install';
    expect(makeCommandNonInteractive(alreadyHardened)).toBe(alreadyHardened);
  });

  it('treats a chained install and dev server as a long running command', () => {
    expect(isDevServerCommand('npm install && npm run dev')).toBe(true);
  });
});
