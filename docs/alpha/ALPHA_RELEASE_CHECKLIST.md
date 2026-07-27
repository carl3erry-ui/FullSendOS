# FullSendOS Alpha Release Checklist

Use this checklist before declaring Alpha complete.

Rule:
- Every checked item must include evidence linked to one or more ALPHA IDs.
- Any unchecked Alpha-gating item blocks release.

## Engineering

- [x] Standalone typecheck passes with zero errors. (ALPHA-035)
- [ ] Build passes on release candidate baseline. (ALPHA-033)
- [ ] Full test suite passes on release candidate baseline. (ALPHA-034)
- [ ] Status model consistency is verified across runtime and typed workflow surfaces. (ALPHA-037)
- [ ] Core workflow run lifecycle is validated end to end. (ALPHA-008, ALPHA-016)
- [ ] Stale run and duplicate-run handling are validated. (ALPHA-020, ALPHA-022)
- [ ] Abort behavior for running and non-running workflows is validated. (ALPHA-023)

## Product

- [ ] Core user journey is validated from client selection to export. (ALPHA-013, ALPHA-014, ALPHA-015, ALPHA-017, ALPHA-018)
- [ ] Engagement lifecycle protections are validated. (ALPHA-019, ALPHA-024)
- [ ] Deliverable readiness labels and disclaimers are accurate. (ALPHA-045, ALPHA-062)
- [ ] Out-of-scope Beta+ items remain excluded from Alpha acceptance. (ALPHA-072, ALPHA-073, ALPHA-074, ALPHA-075)

## Security

- [ ] API responses are reviewed for secret and internal-field safety. (ALPHA-053)
- [ ] Export outputs are reviewed for safety exclusions and ownership controls. (ALPHA-054, ALPHA-029)
- [ ] Runtime data handling policy is reviewed and approved. (ALPHA-056)
- [ ] Security negative checks for leakage paths are complete. (ALPHA-057)
- [ ] Client-facing authentication and authorization baseline is implemented and verified. (ALPHA-052)

## AI

- [ ] xAI timeout behavior is validated in active run path. (ALPHA-039, ALPHA-040)
- [ ] Sanitized error behavior is validated for timeout/network/http failures. (ALPHA-041)
- [ ] Raw provider payload logging remains absent in runtime logs. (ALPHA-042, ALPHA-044)
- [ ] Department validation and repair path is validated. (ALPHA-043)
- [ ] Terminal status normalization including aborted is validated. (ALPHA-009)

## Documentation

- [ ] Documentation review passes and findings are dispositioned for Alpha. (ALPHA-036)
- [ ] Architecture and run-path documentation reflect current state. (ALPHA-031)
- [ ] Alpha Definition of Done, traceability matrix, and roadmap are up to date. (ALPHA-068)

## Testing

- [ ] Regression tests for run, abort, and recovery pass. (ALPHA-019, ALPHA-022, ALPHA-023)
- [ ] Data Room compatibility and safety tests pass. (ALPHA-025, ALPHA-026)
- [ ] Export route and safety tests pass. (ALPHA-011, ALPHA-029, ALPHA-061)
- [ ] Client portal boundary tests pass. (ALPHA-049, ALPHA-050, ALPHA-051)

## Demonstration

- [ ] Demo covers full operator flow and terminal workflow outcome. (ALPHA-063)
- [ ] Demo covers Data Room and evidence-backed output visibility. (ALPHA-064)
- [ ] Demo covers export generation and download. (ALPHA-065)
- [ ] Demo covers client portal boundary checks. (ALPHA-066)
- [ ] Demo logs remain safe with no secret or payload leakage. (ALPHA-067)

## Client Experience

- [ ] Client-safe engagement summaries and deliverable views are verified. (ALPHA-049, ALPHA-051)
- [ ] Internal trace, agent notes, and raw provider output are not visible in client portal. (ALPHA-050)
- [ ] Data-room and deliverable surfaces are client-appropriate for Alpha use case. (ALPHA-007)

## Release Approval

- [ ] Traceability matrix has no unresolved Alpha-gating blockers. (ALPHA-069)
- [ ] PMO approval package is complete and reviewed. (ALPHA-070)
- [ ] Final regression and release readiness check is complete. (ALPHA-071)
- [ ] Alpha complete declaration criteria are fully met. (ALPHA-076, ALPHA-077, ALPHA-078, ALPHA-079, ALPHA-080)

## Final Release Decision

- Release recommendation: [ ] APPROVE [ ] HOLD
- PMO reviewer: TBD
- Product reviewer: TBD
- Engineering reviewer: TBD
- Decision date: TBD
- Notes: TBD