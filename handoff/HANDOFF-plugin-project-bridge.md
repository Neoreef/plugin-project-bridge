# Cross-Company Project Handoff — Project Bridge

**Repository:** `plugin-project-bridge` (shared repo; recipient has its own clone)  
**Source status snapshot:** 27 tasks — backlog: 1, blocked: 1, cancelled: 2, done: 23

> This document is a **self-contained** handoff. It assumes you have **no** access to the source
> company's board, task IDs, agents, files, hosts, credentials, or history. Every task is named
> and placed in a hierarchy; every assignee is given by **role**, never by person. Reproduce this
> tree on your own board. Technical detail is preserved by the **shape** of the systems, not by the
> source company's identifiers.

**Terminology & self-containment.** This platform derives from a publicly available upstream open-source project (referred to here as *the base platform*); that upstream is the only external reference and can be independently obtained. Task names, statuses, hierarchy, and dependencies below carry **no** source-company IDs, person names, host paths, or internal URLs. Literal `PAPERCLIP_*` tokens that remain are **runtime environment-variable names** shared by the identical base platform runtime — they are functional configuration keys you will use verbatim, not brand references.


## How to execute this handoff

1. **Create parents before children.** Walk the Task Register top-down. Create each parent task,
   then its children, linking by **name** (you will assign your own IDs).
2. **Set status faithfully** using the mapping below. Recreate blocker links *before* setting a
   task to `blocked`.
3. **Assign by role.** The recipient company has the **same roles, different individuals**. Use the
   *Recommended owner* on each task (same functional role on your side). `unassigned / board-owned`
   tasks stay owned by your CEO/board until you assign them.
4. **Cancelled tasks are NOT recreated** — they appear only as historical context so the tree reads
   faithfully.
5. **Related sibling / predecessor trees** referenced by a task are noted as *context*; they are
   recreated under **their own root**, not duplicated under the referencing task.

### Status mapping

- `done → **done** (completed; recreate as historical record, mark done)`
- `backlog → **backlog**`
- `blocked → **blocked** (recreate blocker link, then set blocked)`
- `cancelled → **do NOT recreate**; listed as historical context only`

### Role legend (source role → recreate as)

- **CEO** → CEO (same role, recipient's own individual)
- **Chief Financial Officer** → Chief Financial Officer (same role, recipient's own individual)
- **Chief Marketing Officer** → Chief Marketing Officer (same role, recipient's own individual)
- **Chief Technology Officer** → Chief Technology Officer (same role, recipient's own individual)
- **Data Science & Analytics** → Data Science & Analytics (same role, recipient's own individual)
- **DevOps & Infrastructure** → DevOps & Infrastructure (same role, recipient's own individual)
- **QA & Testing** → QA & Testing (same role, recipient's own individual)
- **Senior Engineer, Neoreef Platform** → Senior Engineer, Neoreef Platform (same role, recipient's own individual)
- **Social Media Manager** → Social Media Manager (same role, recipient's own individual)
- **board-owned (human founder/CEO)** → recipient CEO / board (assign or keep board-owned)
- **unassigned / board-owned** → recipient CEO / board (assign or keep board-owned)

## Summary tree (task · status · role)

```
✓ Two-way sync: the base platform issues <-> Zoho Projects tasks  ·  done  ·  board-owned (human founder/CEO)
✓ External entity mapping table  ·  done  ·  board-owned (human founder/CEO)
✓ Status/state mapping configuration  ·  done  ·  Chief Financial Officer
✓ Inbound webhook reliability  ·  done  ·  QA & Testing
○ Zoho Desk ticket bridge  ·  backlog  ·  Chief Technology Officer
✗ Zoho CRM bridge  ·  cancelled  ·  Social Media Manager
✗ Per-company connection / OAuth config  ·  cancelled  ·  Chief Marketing Officer
✓ Kickoff — Project Bridge Plugin (scope + planning)  ·  done  ·  Data Science & Analytics
  ✓ Project Bridge P1.1/P1.2 — origin-identity convention + repair outbound sync  ·  done  ·  Data Science & Analytics
  ✓ Project Bridge P1.3 — authenticate inbound Zoho webhooks  ·  done  ·  Data Science & Analytics
  ✓ Project Bridge P1.5 — reconcile manifest config schema vs per-service state  ·  done  ·  Data Science & Analytics
  ✓ Project Bridge P1.4 — idempotency & sync-loop prevention  ·  done  ·  Data Science & Analytics
  ✓ Project Bridge P1.6 — collapse legacy dual-auth into single per-service model  ·  done  ·  Data Science & Analytics
  ✓ Project Bridge P1.7/P1.8 — unit + round-trip integration tests  ·  done  ·  QA & Testing
  ✓ Project Bridge P1.9 — Zoho sandbox manual verification & v1 sign-off  ·  done  ·  CEO
  ✓ Provision Zoho Projects sandbox + plugin OAuth client (unblocks (a related task) v1 sign-off)  ·  done  ·  CEO
  ✓ Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))  ·  done  ·  Chief Technology Officer
    ✓ Devops: install & publicly expose Project Bridge plugin instance (return inbound webhook URL)  ·  done  ·  DevOps & Infrastructure
    ✓ Diagnose inbound Project Bridge delivery: endpoint reached, no issue created (plugin routing/auth)  ·  done  ·  CEO
    ✓ Inbound e2e: confirm whether real Zoho PR-90 workflow webhook delivers (delivery-log check)  ·  done  ·  DevOps & Infrastructure
    ✓ Deploy Project Bridge plugin update (thin-ping inbound) to cortex  ·  done  ·  DevOps & Infrastructure
    ✓ Deploy Project Bridge: in-app Zoho setup panel + project-notification handler  ·  done  ·  CEO
✓ e2e final cf61b589  ·  done  ·  Chief Financial Officer
✓ secret-fix verify 0ccfc7e0  ·  done  ·  unassigned / board-owned
✓ P19 verify P19-002254-7459e3f5 inbound create  ·  done  ·  unassigned / board-owned
✓ checklist verification task  ·  done  ·  unassigned / board-owned
● T3 — Project Bridge: adopt per-company connection pattern  ·  blocked  ·  Senior Engineer, Neoreef Platform
```

Legend: ✓ done · ✗ cancelled (not recreated) · ● blocked · ◐ in_review · ○ backlog/todo

## Task register (create in this order)

### Two-way sync: the base platform issues <-> Zoho Projects tasks

- **Hierarchy:** Two-way sync: the base platform issues <-> Zoho Projects tasks
- **Parent:** *(root of this project)*
- **Status:** done  →  set **done**
- **Original owner (role):** board-owned (human founder/CEO)
- **Recommended owner:** recipient CEO / board (assign or keep board-owned)
- **Priority:** medium
- **Related context (not recreated under this task):** “Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))”; “e2e final cf61b589”

### External entity mapping table

- **Hierarchy:** External entity mapping table
- **Parent:** *(root of this project)*
- **Status:** done  →  set **done**
- **Original owner (role):** board-owned (human founder/CEO)
- **Recommended owner:** recipient CEO / board (assign or keep board-owned)
- **Priority:** medium

### Status/state mapping configuration

- **Hierarchy:** Status/state mapping configuration
- **Parent:** *(root of this project)*
- **Status:** done  →  set **done**
- **Original owner (role):** Chief Financial Officer
- **Recommended owner:** Chief Financial Officer (same role, recipient's own individual)
- **Priority:** medium

### Inbound webhook reliability

- **Hierarchy:** Inbound webhook reliability
- **Parent:** *(root of this project)*
- **Status:** done  →  set **done**
- **Original owner (role):** QA & Testing
- **Recommended owner:** QA & Testing (same role, recipient's own individual)
- **Priority:** medium

### Zoho Desk ticket bridge

- **Hierarchy:** Zoho Desk ticket bridge
- **Parent:** *(root of this project)*
- **Status:** backlog  →  set **backlog**
- **Original owner (role):** Chief Technology Officer
- **Recommended owner:** Chief Technology Officer (same role, recipient's own individual)
- **Priority:** medium

  <details><summary>Substance (purpose / scope / acceptance / current gate — shape-preserving)</summary>

  Sync Zoho Desk tickets \<-> the base platform issues (surface tickets as issues, push status/comments back). (Starter backlog item proposed from the plugin's purpose — prune/retitle as you triage.)

  </details>

### Zoho CRM bridge

- **Hierarchy:** Zoho CRM bridge
- **Parent:** *(root of this project)*
- **Status:** cancelled  →  set **do not recreate**
- **Original owner (role):** Social Media Manager
- **Recommended owner:** Social Media Manager (same role, recipient's own individual)
- **Priority:** medium

### Per-company connection / OAuth config

- **Hierarchy:** Per-company connection / OAuth config
- **Parent:** *(root of this project)*
- **Status:** cancelled  →  set **do not recreate**
- **Original owner (role):** Chief Marketing Officer
- **Recommended owner:** Chief Marketing Officer (same role, recipient's own individual)
- **Priority:** medium

### Kickoff — Project Bridge Plugin (scope + planning)

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning)
- **Parent:** *(external / out-of-scope tree — not recreated here; treat as context)*
- **Status:** done  →  set **done**
- **Original owner (role):** Data Science & Analytics
- **Recommended owner:** Data Science & Analytics (same role, recipient's own individual)
- **Priority:** high
- **Children (create after this task):** “Project Bridge P1.1/P1.2 — origin-identity convention + repair outbound sync”; “Project Bridge P1.3 — authenticate inbound Zoho webhooks”; “Project Bridge P1.5 — reconcile manifest config schema vs per-service state”; “Project Bridge P1.4 — idempotency & sync-loop prevention”; “Project Bridge P1.6 — collapse legacy dual-auth into single per-service model”; “Project Bridge P1.7/P1.8 — unit + round-trip integration tests”; “Project Bridge P1.9 — Zoho sandbox manual verification & v1 sign-off”; “Provision Zoho Projects sandbox + plugin OAuth client (unblocks (a related task) v1 sign-off)”; “Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))”
- **Blocked by (create/link first):** “Kickoff — Agent Channels Plugin (planning)” (done); “Kickoff — Knowledge Bridge Plugin (planning)” (done)
- **Related context (not recreated under this task):** “Kickoff task”

### Project Bridge P1.1/P1.2 — origin-identity convention + repair outbound sync

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Project Bridge P1.1/P1.2 — origin-identity convention + repair outbound sync
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** Data Science & Analytics
- **Recommended owner:** Data Science & Analytics (same role, recipient's own individual)
- **Priority:** high
- **Blocks:** “Project Bridge P1.4 — idempotency & sync-loop prevention” (done); “Project Bridge P1.7/P1.8 — unit + round-trip integration tests” (done)

### Project Bridge P1.3 — authenticate inbound Zoho webhooks

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Project Bridge P1.3 — authenticate inbound Zoho webhooks
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** Data Science & Analytics
- **Recommended owner:** Data Science & Analytics (same role, recipient's own individual)
- **Priority:** high
- **Related context (not recreated under this task):** “Project Bridge P1.5 — reconcile manifest config schema vs per-service state”; “Project Bridge P1.4 — idempotency & sync-loop prevention”

### Project Bridge P1.5 — reconcile manifest config schema vs per-service state

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Project Bridge P1.5 — reconcile manifest config schema vs per-service state
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** Data Science & Analytics
- **Recommended owner:** Data Science & Analytics (same role, recipient's own individual)
- **Priority:** medium
- **Blocks:** “Project Bridge P1.6 — collapse legacy dual-auth into single per-service model” (done)

### Project Bridge P1.4 — idempotency & sync-loop prevention

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Project Bridge P1.4 — idempotency & sync-loop prevention
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** Data Science & Analytics
- **Recommended owner:** Data Science & Analytics (same role, recipient's own individual)
- **Priority:** high
- **Blocked by (create/link first):** “Project Bridge P1.1/P1.2 — origin-identity convention + repair outbound sync” (done)
- **Blocks:** “Project Bridge P1.7/P1.8 — unit + round-trip integration tests” (done)

### Project Bridge P1.6 — collapse legacy dual-auth into single per-service model

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Project Bridge P1.6 — collapse legacy dual-auth into single per-service model
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** Data Science & Analytics
- **Recommended owner:** Data Science & Analytics (same role, recipient's own individual)
- **Priority:** medium
- **Blocked by (create/link first):** “Project Bridge P1.5 — reconcile manifest config schema vs per-service state” (done)

### Project Bridge P1.7/P1.8 — unit + round-trip integration tests

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Project Bridge P1.7/P1.8 — unit + round-trip integration tests
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** QA & Testing
- **Recommended owner:** QA & Testing (same role, recipient's own individual)
- **Priority:** high
- **Blocked by (create/link first):** “Project Bridge P1.1/P1.2 — origin-identity convention + repair outbound sync” (done); “Project Bridge P1.4 — idempotency & sync-loop prevention” (done)

### Project Bridge P1.9 — Zoho sandbox manual verification & v1 sign-off

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Project Bridge P1.9 — Zoho sandbox manual verification & v1 sign-off
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** CEO
- **Recommended owner:** CEO (same role, recipient's own individual)
- **Priority:** medium
- **Related context (not recreated under this task):** “Provision Zoho Projects sandbox + plugin OAuth client (unblocks (a related task) v1 sign-off)”; “Project Bridge P1.3 — authenticate inbound Zoho webhooks”; “Project Bridge P1.5 — reconcile manifest config schema vs per-service state”; “Project Bridge P1.1/P1.2 — origin-identity convention + repair outbound sync”; “Project Bridge P1.4 — idempotency & sync-loop prevention”; “Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))”; “Inbound e2e: confirm whether real Zoho PR-90 workflow webhook delivers (delivery-log check)”; “checklist verification task”

### Provision Zoho Projects sandbox + plugin OAuth client (unblocks (a related task) v1 sign-off)

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Provision Zoho Projects sandbox + plugin OAuth client (unblocks (a related task) v1 sign-off)
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** CEO
- **Recommended owner:** CEO (same role, recipient's own individual)
- **Priority:** high
- **Related context (not recreated under this task):** “Project Bridge P1.9 — Zoho sandbox manual verification & v1 sign-off”; “Project Bridge P1.4 — idempotency & sync-loop prevention”; “Project Bridge P1.1/P1.2 — origin-identity convention + repair outbound sync”; “Project Bridge P1.3 — authenticate inbound Zoho webhooks”; “Project Bridge P1.5 — reconcile manifest config schema vs per-service state”

### Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))
- **Parent:** “Kickoff — Project Bridge Plugin (scope + planning)”
- **Status:** done  →  set **done**
- **Original owner (role):** Chief Technology Officer
- **Recommended owner:** Chief Technology Officer (same role, recipient's own individual)
- **Priority:** high
- **Children (create after this task):** “Devops: install & publicly expose Project Bridge plugin instance (return inbound webhook URL)”; “Diagnose inbound Project Bridge delivery: endpoint reached, no issue created (plugin routing/auth)”; “Inbound e2e: confirm whether real Zoho PR-90 workflow webhook delivers (delivery-log check)”; “Deploy Project Bridge plugin update (thin-ping inbound) to cortex”; “Deploy Project Bridge: in-app Zoho setup panel + project-notification handler”
- **Related context (not recreated under this task):** “Project Bridge P1.9 — Zoho sandbox manual verification & v1 sign-off”; “inbound verify neo106-verify-1781283191”; “e2e final cf61b589”; “Project Bridge P1.4 — idempotency & sync-loop prevention”; “Provision Zoho Projects sandbox + plugin OAuth client (unblocks (a related task) v1 sign-off)”; “Authenticated Test Task”; “secret-fix verify 0ccfc7e0”

### Devops: install & publicly expose Project Bridge plugin instance (return inbound webhook URL)

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task)) › Devops: install & publicly expose Project Bridge plugin instance (return inbound webhook URL)
- **Parent:** “Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))”
- **Status:** done  →  set **done**
- **Original owner (role):** DevOps & Infrastructure
- **Recommended owner:** DevOps & Infrastructure (same role, recipient's own individual)
- **Priority:** high

### Diagnose inbound Project Bridge delivery: endpoint reached, no issue created (plugin routing/auth)

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task)) › Diagnose inbound Project Bridge delivery: endpoint reached, no issue created (plugin routing/auth)
- **Parent:** “Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))”
- **Status:** done  →  set **done**
- **Original owner (role):** CEO
- **Recommended owner:** CEO (same role, recipient's own individual)
- **Priority:** high
- **Related context (not recreated under this task):** “inbound verify neo106-verify-1781283191”

### Inbound e2e: confirm whether real Zoho PR-90 workflow webhook delivers (delivery-log check)

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task)) › Inbound e2e: confirm whether real Zoho PR-90 workflow webhook delivers (delivery-log check)
- **Parent:** “Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))”
- **Status:** done  →  set **done**
- **Original owner (role):** DevOps & Infrastructure
- **Recommended owner:** DevOps & Infrastructure (same role, recipient's own individual)
- **Priority:** high
- **Related context (not recreated under this task):** “Diagnose inbound Project Bridge delivery: endpoint reached, no issue created (plugin routing/auth)”; “inbound verify neo106-verify-1781283191”

### Deploy Project Bridge plugin update (thin-ping inbound) to cortex

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task)) › Deploy Project Bridge plugin update (thin-ping inbound) to cortex
- **Parent:** “Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))”
- **Status:** done  →  set **done**
- **Original owner (role):** DevOps & Infrastructure
- **Recommended owner:** DevOps & Infrastructure (same role, recipient's own individual)
- **Priority:** high

### Deploy Project Bridge: in-app Zoho setup panel + project-notification handler

- **Hierarchy:** Kickoff — Project Bridge Plugin (scope + planning) › Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task)) › Deploy Project Bridge: in-app Zoho setup panel + project-notification handler
- **Parent:** “Operator: inbound Zoho→the base platform webhook delivery for Project Bridge (unblocks (a related task))”
- **Status:** done  →  set **done**
- **Original owner (role):** CEO
- **Recommended owner:** CEO (same role, recipient's own individual)
- **Priority:** medium
- **Related context (not recreated under this task):** “e2e final cf61b589”

### e2e final cf61b589

- **Hierarchy:** e2e final cf61b589
- **Parent:** *(root of this project)*
- **Status:** done  →  set **done**
- **Original owner (role):** Chief Financial Officer
- **Recommended owner:** Chief Financial Officer (same role, recipient's own individual)
- **Priority:** high

### secret-fix verify 0ccfc7e0

- **Hierarchy:** secret-fix verify 0ccfc7e0
- **Parent:** *(root of this project)*
- **Status:** done  →  set **done**
- **Original owner (role):** unassigned / board-owned
- **Recommended owner:** recipient CEO / board (assign or keep board-owned)
- **Priority:** medium

### P19 verify P19-002254-7459e3f5 inbound create

- **Hierarchy:** P19 verify P19-002254-7459e3f5 inbound create
- **Parent:** *(root of this project)*
- **Status:** done  →  set **done**
- **Original owner (role):** unassigned / board-owned
- **Recommended owner:** recipient CEO / board (assign or keep board-owned)
- **Priority:** low

### checklist verification task

- **Hierarchy:** checklist verification task
- **Parent:** *(root of this project)*
- **Status:** done  →  set **done**
- **Original owner (role):** unassigned / board-owned
- **Recommended owner:** recipient CEO / board (assign or keep board-owned)
- **Priority:** high
- **Related context (not recreated under this task):** “Project Bridge P1.9 — Zoho sandbox manual verification & v1 sign-off”

### T3 — Project Bridge: adopt per-company connection pattern

- **Hierarchy:** T3 — Project Bridge: adopt per-company connection pattern
- **Parent:** *(root of this project)*
- **Status:** blocked  →  set **blocked**
- **Original owner (role):** Senior Engineer, Neoreef Platform
- **Recommended owner:** Senior Engineer, Neoreef Platform (same role, recipient's own individual)
- **Priority:** medium
- **Blocked by (create/link first):** “T1 — Extract shared per-company connection module” (in_review)
- **Blocks:** “T5 — Docs + reinstall re-verification for tenant-facing multitenancy” (blocked)
- **Related context (not recreated under this task):** “T2 test”; “Move token storage to per-company (multitenant)”; “Per-company connection / OAuth config”

  <details><summary>Substance (purpose / scope / acceptance / current gate — shape-preserving)</summary>

  ## T3 — Project Bridge: adopt per-company connection pattern

  Part of the [“Move token storage to per-company (multitenant)”]”) multitenant initiative (umbrella). **Folds in [“Per-company connection / OAuth config”]** (Per-company connection / OAuth config, backlog).

  Adopt the shared connection module from [“T1 — Extract shared per-company connection module”] (T1) in **Project Bridge** so its connection/config is per-company and tenant-facing, matching Agent Channels.

  ### Scope
  - Consume the T1 shared per-company connection module (scope-keyed store + legacy fallback).
  - Add the tenant-facing connect surface (mirror the Agent Channels hosted connect page in [“T2 test”]) for Project Bridge's external org connection.
  - Resolve/close [“Per-company connection / OAuth config”] as part of this work.

  ### Done when
  - Project Bridge stores connection config per company and a tenant can connect without operator UI access.

  **Blocked by [“T1 — Extract shared per-company connection module”] (T1).** Separate repo/workspace from “Move token storage to per-company (multitenant)” (Project Bridge plugin).

  </details>
