import { describe, expect, it } from 'vitest';
import { getFineTunedPrompt } from './new-prompt';
import { CRESOVA_DESIGN_KIT } from './cresova-design-kit';

/**
 * El prompt base y el kit de Cresova viajan juntos en cada build, y durante meses se
 * contradijeron en tres ejes distintos. El modelo leía las dos cosas.
 *
 * Ninguna de estas contradicciones se veía en un diff: cada archivo, leído solo, era coherente.
 * Aparecen únicamente cuando se leen como lo que son — un solo prompt — y por eso este test las
 * mira juntas.
 */

const sinSupabase = getFineTunedPrompt('/home/project');

describe('el prompt base y el design kit', () => {
  it('no mandan usar una base de datos en un sitio que el kit define como frontend-only', () => {
    /*
     * El kit dice «THESE ARE FRONTEND-ONLY DEMOS … No Supabase, no database, no auth». El prompt
     * base decía, en mayúsculas, «CRITICAL: Use Supabase for databases by default» y seguía con 86
     * líneas de migraciones SQL. Ahora ese bloque solo entra cuando hay una conexión de verdad.
     */
    expect(CRESOVA_DESIGN_KIT).toContain('FRONTEND-ONLY DEMOS');
    expect(sinSupabase).not.toContain('<database_instructions>');
    expect(sinSupabase).not.toMatch(/CRITICAL:\s*Use Supabase/);
  });

  it('sigue trayendo las instrucciones de base de datos cuando hay conexión', () => {
    const conSupabase = getFineTunedPrompt('/home/project', {
      isConnected: true,
      hasSelectedProject: true,
      credentials: { anonKey: 'k', supabaseUrl: 'u' },
    });

    expect(conSupabase).toContain('<database_instructions>');
    expect(conSupabase).toContain('CREATE TABLE IF NOT EXISTS');
  });

  it('no manda inventar URLs de fotos de stock', () => {
    /*
     * Decía «Bolt ALWAYS uses stock photos from Pexels (valid URLs only)» en
     * <technology_preferences>, y ciento ochenta líneas después «Use only the URLs given in
     * <cresova_images>. Never invent a stock photo URL». La primera es la que estaba arriba y en
     * mayúsculas. Es el mecanismo exacto de una página con las fotos rotas.
     */
    expect(sinSupabase).not.toMatch(/ALWAYS uses stock photos/i);
    expect(sinSupabase).not.toMatch(/Use Pexels for photos/i);

    for (const mention of sinSupabase.split('\n').filter((line) => /pexels/i.test(line))) {
      expect(mention, `esta línea manda usar Pexels directo: ${mention}`).toMatch(/cresova_images/i);
    }
  });

  it('no manda un estilo que su propia lista de NEVER prohíbe', () => {
    /*
     * «enforce modern design patterns: generous whitespace, soft shadows, rounded corners» está a
     * doscientas líneas de «A grid of rounded cards as the answer to every section» y «every
     * corner the same 16px radius», que son NEVER en el mismo archivo.
     */
    expect(sinSupabase).toContain('A grid of rounded cards as the answer to every section');
    expect(sinSupabase).not.toMatch(/enforce modern design patterns/i);
  });
});
