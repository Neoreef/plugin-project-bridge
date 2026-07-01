Project Bridge is a Paperclip plugin that bridges Paperclip agents and issues with the project and task management platforms users already work in. Paperclip is a governance architecture that manages work for agents by tracking goals, projects, and issues — but it lacks the surfaces users need to engage with it inside their own workflows.

Project Bridge closes part of that gap, providing an integration point for popular project management platforms such as Zoho Projects, Zoho Desk, Zoho CRM, and others.
The plugin maps each project, issue, user, and agent to outside systems — giving users an accessible, familiar interface to their agent work Paperclip governs.
## Releasing (built `dist/` is committed)

This plugin is installed on the fleet as a package from a pinned git ref:

```
pnpm paperclipai plugin install github:Neoreef/<repo>#<ref>
```

The server's package-install path runs `npm install --ignore-scripts`, so it **does
not build** — the pinned ref must already contain built output under `dist/`. For
that reason `dist/` is **committed to this repo** (it is intentionally *not*
gitignored) and listed in `package.json` `files`, mirroring the honcho plugin.

**Convention (Option A, honcho-shape — NEO-311): every release must rebuild and
commit `dist/`.** Before tagging/pinning a release ref:

1. `npm install` (or `pnpm install`)
2. `npm run build` — regenerates `dist/` (manifest + worker + ui)
3. commit the updated `dist/` on the release branch
4. the resulting commit SHA is the ref the fleet manifest pins

Skipping the rebuild ships stale output to the fleet.
