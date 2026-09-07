import { describe, expect, it } from 'vitest';
import { isTruncatedArtifact } from './execution-guard';

/**
 * The server continues a response that stops on the completion limit, but the five-segment ceiling
 * and a stream that errors mid-response both end a turn with the artifact still open. Those turns
 * do have actions, so every other check in the guard reads them as a normal build and the user is
 * left with half a site.
 */
describe('isTruncatedArtifact', () => {
  it('sees an artifact that was opened and never closed', () => {
    const cut = `Voy a construirlo.
<boltArtifact id="sitio" title="Sitio">
<boltAction type="file" filePath="index.html">
<!doctype html>`;

    expect(isTruncatedArtifact(cut)).toBe(true);
  });

  it('leaves a finished artifact alone', () => {
    const whole = `Listo.
<boltArtifact id="sitio" title="Sitio">
<boltAction type="file" filePath="index.html">hola</boltAction>
</boltArtifact>`;

    expect(isTruncatedArtifact(whole)).toBe(false);
  });

  it('leaves a turn that never opened one alone', () => {
    expect(isTruncatedArtifact('Te explico cómo funciona el hero.')).toBe(false);
  });

  it('catches the second artifact of a turn being cut off', () => {
    const cut = `<boltArtifact id="uno" title="Uno">
<boltAction type="file" filePath="a.txt">a</boltAction>
</boltArtifact>
<boltArtifact id="dos" title="Dos">
<boltAction type="file" filePath="b.txt">b`;

    expect(isTruncatedArtifact(cut)).toBe(true);
  });
});
