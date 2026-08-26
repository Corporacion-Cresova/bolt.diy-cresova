import { describe, expect, it } from 'vitest';
import { describePreviewEmbedding, type PreviewEmbedding } from './preview-embedding';

const base: PreviewEmbedding = {
  url: 'https://cresova-abc.preview.cresova.com',
  status: 200,
  builderIsIsolated: true,
};

const report = (check: Partial<PreviewEmbedding>) => describePreviewEmbedding({ ...base, ...check }).join('\n');

describe('describePreviewEmbedding', () => {
  it('calls a preview embeddable when it sends both headers', () => {
    const lines = report({ embedderPolicy: 'credentialless', resourcePolicy: 'cross-origin' });

    expect(lines).toContain('se puede incrustar: sí');
  });

  it('accepts require-corp as well as credentialless', () => {
    const lines = report({ embedderPolicy: 'require-corp', resourcePolicy: 'cross-origin' });

    expect(lines).toContain('se puede incrustar: sí');
  });

  it('names the missing embedder policy, which is the half that shipped last', () => {
    /*
     * This is the exact state production was in: the resource policy was there, the frame was still
     * refused, and the report said nothing that could tell those apart. Satisfying one of the two
     * conditions has to read as a failure, and say which one is missing.
     */
    const lines = report({ resourcePolicy: 'cross-origin' });

    expect(lines).toContain('se puede incrustar: NO');
    expect(lines).toContain('no basta con la de recurso');
  });

  it('names the missing resource policy too', () => {
    const lines = report({ embedderPolicy: 'credentialless' });

    expect(lines).toContain('falta la cabecera de recurso');
  });

  it('says neither is needed when the builder imposes no policy', () => {
    const lines = report({ builderIsIsolated: false });

    expect(lines).toContain('se puede incrustar: sí');
    expect(lines).toContain('no impone ninguna condición');
  });

  it('reports a failed request as a failed request, not as a verdict about headers', () => {
    const lines = report({ status: undefined, error: 'Failed to fetch' });

    expect(lines).toContain('no se pudo consultar: Failed to fetch');
    expect(lines).not.toContain('se puede incrustar');
  });
});
