# AGENTS.md — jumping-beans

Product repository for the Jumping Beans affiliate and partner experiences.

## Working rules

- Read BeanMind `MEMORY.md` and the relevant files under `docs/` before work;
  record durable outcomes afterward without storing credentials or secrets.
- Work only in an isolated Hub task branch/worktree. Preserve existing dirty
  primary changes; never reset, delete, overwrite, or silently publish them.
- Keep partner catalogs, tools, static assets, headers, and deployment config
  internally consistent. Treat partner and affiliate configuration as
  potentially sensitive even when it is not a credential.
- The canonical location is `~/beans/products/jumping-beans`, registered in
  `~/beans/platform/agency/repos.json`.

## Validation

- Inspect the changed partner and engine files together; validate JSON and
  JavaScript syntax for changed files.
- Run the narrowest available local checks and review generated/static output.
- Cloudflare/Vercel deployment checks are read-only unless explicitly
  approved. Never print, commit, or copy credentials.

## Hub and release

Actionable work enters the gated Agency Hub and is performed in an isolated
worktree with deterministic evidence, corroborative review, and adversarial
review. No tag, push, deployment, or production claim occurs without explicit
release approval.
