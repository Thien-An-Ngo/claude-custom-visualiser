import { describe, it, expect } from 'vitest';

describe('CSS design tokens', () => {
  it('defines expected token names', async () => {
    // These are the token names we commit to — if they change, this test catches it
    const expectedTokens = [
      '--color-bg',
      '--color-surface',
      '--color-border',
      '--color-red',
      '--color-gold',
      '--color-text',
      '--color-muted',
      '--color-ghost',
    ];
    // Read the actual CSS file
    const fs = await import('fs');
    const css = fs.readFileSync('src/app.css', 'utf-8');
    for (const token of expectedTokens) {
      expect(css).toContain(token);
    }
  });
});
