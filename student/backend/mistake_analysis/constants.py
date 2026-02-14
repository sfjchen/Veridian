SEVERITIES = ["conceptual", "procedural", "mechanical", "notational"]

TAG_BANK = {
    "conceptual": [
        "wrong-theorem",           # applied a theorem that doesn't hold here
        "misunderstood-definition", # misunderstands what a term/object means
        "domain-error",            # used expression outside its valid domain
        "incorrect-assumption",    # assumed something not given or not true
        "flawed-logic",            # logical reasoning step is invalid
    ],
    "procedural": [
        "wrong-method",            # correct concept, wrong technique chosen
        "skipped-step",            # jumped over a necessary intermediate step
        "incorrect-application",   # right method, applied it wrong
        "order-of-operations",     # steps done in wrong sequence
    ],
    "mechanical": [
        "sign-error",              # dropped or flipped a sign
        "arithmetic-error",        # basic computation mistake
        "algebra-error",           # simplification / manipulation slip
        "lost-term",               # term dropped during manipulation
    ],
    "notational": [
        "ambiguous-notation",      # notation is unclear or non-standard
        "missing-quantifier",      # missing ∀, ∃, limits, etc.
        "inconsistent-variables",  # variable reuse or mismatch
    ],
}

ALL_TAGS = [tag for tags in TAG_BANK.values() for tag in tags]
TAG_TO_SEVERITY = {tag: sev for sev, tags in TAG_BANK.items() for tag in tags}
