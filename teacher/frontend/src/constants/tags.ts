/** Tag abbreviations for compact heatmap display. */
export const TAG_ABBREV: Record<string, string> = {
  "wrong-theorem": "WThm", "misunderstood-definition": "MDef",
  "domain-error": "Dom", "incorrect-assumption": "IAsm", "flawed-logic": "FLog",
  "wrong-method": "WMth", "skipped-step": "Skip",
  "incorrect-application": "IApp", "order-of-operations": "OoO",
  "sign-error": "Sign", "arithmetic-error": "Arth",
  "algebra-error": "Algb", "lost-term": "Lost",
  "ambiguous-notation": "ANot", "missing-quantifier": "MQnt",
  "inconsistent-variables": "IVar",
};

/** Maps each mistake tag to its severity category. */
export const TAG_TO_SEVERITY: Record<string, string> = {
  "wrong-theorem": "conceptual", "misunderstood-definition": "conceptual",
  "domain-error": "conceptual", "incorrect-assumption": "conceptual", "flawed-logic": "conceptual",
  "wrong-method": "procedural", "skipped-step": "procedural",
  "incorrect-application": "procedural", "order-of-operations": "procedural",
  "sign-error": "mechanical", "arithmetic-error": "mechanical",
  "algebra-error": "mechanical", "lost-term": "mechanical",
  "ambiguous-notation": "notational", "missing-quantifier": "notational",
  "inconsistent-variables": "notational",
};
