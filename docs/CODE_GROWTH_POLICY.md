# JavaScript growth check

Advances Milestone 1 / OPS-3 and OPS-4. Run `npm run check:code-growth` before
submitting a candidate; the pull-request workflow runs the same command and
`node --test scripts/tests/check-code-growth.test.js`.

The previous 110,000-line cap included generated shape and emoji data and was
already exceeded by the existing candidate. Its individual-file ceilings also
predated accepted functionality. This made the pull-request check reject the
existing code without identifying new growth.

The November 5, 2026 working-source baseline has 114,442 handwritten JavaScript
lines, excluding 15,911 generated shape/emoji data lines and distribution files.
The new total ceiling is 115,000 lines: 558 lines of headroom, under 0.5% of the
baseline. Existing handwritten files over 1,000 lines are capped at their
measured line counts in `scripts/code-growth-baseline.json`; other files may not
exceed 1,000 lines. A future baseline change needs explicit review and a reason,
not an automatic refresh. These limits control source growth; they do not
replace the separate transferred-bundle or performance budgets.

The recorded baseline describes the working source reviewed on November 5. It
must be checked against the exact public release candidate before the workflow
can qualify that candidate. A successful local check is not remote CI evidence.
