import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { findBannedWords } from '../tone';
import { validateSummary } from '../summaryValidation';

describe('findBannedWords', () => {
  it.each([
    'migliore', 'Migliori', 'peggiore', 'conviene', 'conveniente', 'consigliato', 'Consigliata', 'consigliati',
    'compra', 'comprare', 'acquista', 'dovresti', 'raccomandato', 'raccomandazione', 'raccomandiamo',
    'comprando', 'comprato', 'comprata', 'comprati', 'comprate', 'compri', 'comprerei', 'comprereste',
    'acquistando', 'acquistato', 'acquistata', 'acquistati', 'acquisterei', 'acquisteresti',
    'dovrebbero', 'dovrebbe', 'dovrei', 'dovresti', 'dovreste',
  ])('flags %s', (w) => {
    expect(findBannedWords(`Questo prodotto è ${w} oggi.`).length).toBeGreaterThan(0);
  });

  it.each([
    'Il prezzo è compreso nel costo.',
    'Il fondo comprende 500 titoli.',
    'Costi compresi.',
    'Una comprensione dei dati.',
    'Il costo di acquisto non è incluso.',
    'Il TER è 0,20%.',
    'Gli acquisti sono tassati.',
    'Il fondo comprende azioni.',
  ])('does not flag neutral near-miss: %s', (t) => {
    expect(findBannedWords(t)).toEqual([]);
  });

  it('handles accented text boundaries', () => {
    expect(findBannedWords('È più conveniente così')).toEqual(['conveniente']);
    expect(findBannedWords('perché compra')).toEqual(['compra']);
  });

  it('is used by summary validation', () => {
    expect(validateSummary('Il fondo è consigliato.', {})).toEqual({ ok: false, reason: 'parole non ammesse' });
    expect(validateSummary('Il fondo comprende titoli.', {}).ok).toBe(true);
  });
});

/** Italian string literals of the given source files (comments stripped). */
function literals(src: string): string[] {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...code.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`|>([^<>{}\n]+)</g)].map(
    (m) => m[1] ?? m[2] ?? m[3] ?? m[4] ?? '',
  );
}

describe('UI copy scan', () => {
  // src/app/api is skipped: the summary prompt quotes banned words as negative instructions.
  const dirs = ['src/lib', 'src/components', 'src/app'];
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__') walk(p);
      } else if (/\.tsx?$/.test(e.name) && !/tone\.ts$/.test(e.name) && !/summaryValidation\.ts$/.test(e.name) && !p.includes('/api/')) files.push(p);
    }
  };
  dirs.forEach(walk);

  it('scans files', () => {
    for (const f of ['labels.ts', 'profileFit.ts', 'report.ts']) expect(files.some((x) => x.endsWith(f))).toBe(true);
  });

  it.each(files)('has no banned words in %s', (f) => {
    const hits = literals(readFileSync(f, 'utf8')).flatMap((s) => findBannedWords(s).map((w) => `${w} in "${s}"`));
    expect(hits).toEqual([]);
  });
});
