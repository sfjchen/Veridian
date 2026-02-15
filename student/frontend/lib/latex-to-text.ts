const SYMBOL_MAP: Record<string, string> = {
  '\\pi': '\u03C0',
  '\\theta': '\u03B8',
  '\\alpha': '\u03B1',
  '\\beta': '\u03B2',
  '\\gamma': '\u03B3',
  '\\delta': '\u03B4',
  '\\infty': '\u221E',
  '\\pm': '\u00B1',
  '\\times': '\u00D7',
  '\\div': '\u00F7',
  '\\leq': '\u2264',
  '\\geq': '\u2265',
  '\\neq': '\u2260',
  '\\approx': '\u2248',
  '\\cdot': '\u00B7',
  '\\ldots': '\u2026',
  '\\rightarrow': '\u2192',
  '\\leftarrow': '\u2190',
};

export function latexToText(latex: string): string {
  let text = latex;

  // \frac{a}{b} → (a)/(b)
  text = text.replace(/\\frac\{([^}]*)}\{([^}]*)}/g, '($1)/($2)');

  // \sqrt{x} → √x
  text = text.replace(/\\sqrt\{([^}]*)}/g, '\u221A$1');

  // Named symbols
  for (const [cmd, char] of Object.entries(SYMBOL_MAP)) {
    text = text.replaceAll(cmd, char);
  }

  // Strip remaining \command sequences
  text = text.replace(/\\[a-zA-Z]+/g, '');

  // Remove $, {, }
  text = text.replace(/[${}]/g, '');

  return text.trim();
}
