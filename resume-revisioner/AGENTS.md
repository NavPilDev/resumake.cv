<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project context

See the root [AGENTS.md](../.claude/AGENTS.md) for the overall repo/Resumake.cv plan. In short: this app is the current home of **Resumake.cv**, a planned single local, Ollama-powered program — write code with that eventual standalone-tool audience in mind, not just this repo's own data.

- [`experience.yaml`](../experience.yaml) is read fresh from the repo root on every request (see [`lib/repoPaths.ts`](lib/repoPaths.ts) / [`lib/loadExperience.ts`](lib/loadExperience.ts)) — don't cache it across requests.
- The **"input your experience"** feature (editing the `experience.yaml` bullet bank from the UI, instead of hand-editing YAML) is built — see the "My Experience" tab section below — but is still actively evolving, so check current `app/`/`lib/` files rather than assuming the README already documents the latest state.
- See [README.md](README.md) for how the existing analyze/improve/generate-resume flow works before changing it.
