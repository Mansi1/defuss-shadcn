import { describe, expect, it } from 'vitest';
import { readmeCssOnlyProblems } from '../scripts/lib/readme.ts';

/**
 * Why: verify.ts's "README/index CSS-only stat" gates compare the advertised
 * "N of M components need no JavaScript" claim against the real component
 * tree. The comparison logic lives in scripts/lib/readme.ts as a pure
 * function so these tests pin the contract (line present, numbers correct,
 * both files checked) without touching the filesystem.
 */
const actual = { cssOnly: 42, total: 68 };

describe('readmeCssOnlyProblems', () => {
  it('passes when the stated counts match the actual tree', () => {
    const text = 'Some intro. **42 of 68 components need no JavaScript.** More text.';
    expect(readmeCssOnlyProblems(text, 'README.md', actual)).toEqual([]);
  });

  it('flags stale counts with a problem naming both numbers', () => {
    const problems = readmeCssOnlyProblems(
      '**28 of 54 components need no JavaScript.**',
      'README.md',
      actual,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('README.md');
    expect(problems[0]).toContain('28 of 54');
    expect(problems[0]).toContain('42 of 68');
  });

  it('flags a missing line so the fix instruction points at both files', () => {
    const problems = readmeCssOnlyProblems('# README without stats', 'a.md', actual);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('a.md');
    expect(problems[0]).toContain('need no JavaScript');
  });

  it('tolerates whitespace and casing variants of the claim', () => {
    const text = '42 of 68 components need no javascript';
    expect(readmeCssOnlyProblems(text, 'x', actual)).toEqual([]);
  });
});
