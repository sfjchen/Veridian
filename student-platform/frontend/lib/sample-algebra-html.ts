/**
 * HTML version of the sample algebra worksheet, rendered inside a WebView
 * on native platforms. Mirrors the problems in SampleAlgebraContent.tsx.
 */
export const SAMPLE_ALGEBRA_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; margin: 0; color: #374151; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
  .subtitle { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
  .problem { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
  .problem-num { font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px; }
  .equation { font-size: 18px; margin: 8px 0; color: #111827; }
  .work { margin-top: 12px; min-height: 48px; font-size: 14px; color: #9ca3af; }
</style>
</head>
<body>
  <h1>Sample Algebra Problems</h1>
  <p class="subtitle">Work through each problem. Use the space below each for your work.</p>
  <div class="problem">
    <div class="problem-num">1. Solve for x</div>
    <div class="equation">2x + 5 = 13</div>
    <div class="work">Show your work here.</div>
  </div>
  <div class="problem">
    <div class="problem-num">2. Solve for x</div>
    <div class="equation">3(x − 4) = 15</div>
    <div class="work">Show your work here.</div>
  </div>
  <div class="problem">
    <div class="problem-num">3. Simplify</div>
    <div class="equation">4x + 2 − 3x + 7</div>
    <div class="work">Show your work here.</div>
  </div>
  <div class="problem">
    <div class="problem-num">4. Solve for x</div>
    <div class="equation">x/2 + 3 = 8</div>
    <div class="work">Show your work here.</div>
  </div>
  <div class="problem">
    <div class="problem-num">5. Solve the system (optional)</div>
    <div class="equation">x + y = 10</div>
    <div class="equation">2x − y = 2</div>
    <div class="work">Show your work here.</div>
  </div>
</body>
</html>`;
