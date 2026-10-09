# CLAUDE.md

Guidance for Claude Code (and other AI assistants) working in this repo (`event-ticketing-frontend`: React + TypeScript + Vite client for the `event-ticketing-api` Spring Boot backend).

## Never do

Hard rules. They apply every time, whatever else a task says.

**Scope: this repo only**
- Never edit the API repo (`event-ticketing-api`). Do not change, create, delete, commit, reformat or run write commands (including database writes) there. Reading its code or `openapi.yaml`, or read-only queries, to understand behavior is fine. Only files under this repo may be changed.
- Never write an API change request as a file. When the API needs a new endpoint, field or rule, give the prompt as text in the chat reply, in a fenced block, so it can be pasted into the API session. Do not save it to `docs/` or anywhere else.
- Never do more than was asked: no extra features, screens or refactors. Name anything skipped in one line.
- Never guess at an ambiguous request that is really a design decision (money, permissions, who can do what): ask first. Never act on a question the user dismissed or interrupted.

**Git and GitHub**
- Never add a `Co-Authored-By: Claude ...` line, a "Generated with Claude Code" line, or any other Claude/Anthropic attribution to a commit message, PR description or code comment.
- Never commit, push, merge, open a PR or switch branches unless the user asks for it in that message. End a code-change turn with a commit-message-style summary instead.
- Never force-push, rewrite published history (`filter-branch`, rebase or amend of pushed commits) or delete a remote branch without an explicit request for that exact action. Take a backup branch first.
- Never use `--no-verify` or skip hooks, and never leave merge-conflict markers in any file.

**The frontend must not lie about the API**
- Never fake data or build local-only stand-ins and present them as real. If the API lacks something, say so, build only what works today, and describe what the API must add.
- Never weaken a permission check in the UI to make something show up. Hiding a button is not security: the API enforces the rule.

**Secrets**
- Never enter, invent or print real credentials, tokens or keys, and never commit them or put them in code, `.env.example` or commit messages. Use test values only.

**Quality and honesty**
- Never say a change works without checking it. Run `npx tsc -b --noEmit` and say plainly what was and was not verified in the browser.
- Never delete or overwrite a file without looking at what is in it first.
- Never run a destructive command (`rm -rf`, `git reset --hard`, `git clean`) unless asked.

## Commands

- Install: `npm install`
- Dev server: `npm run dev` (http://localhost:5173, proxies `/api` to `VITE_API_TARGET`, default `http://localhost:8081`)
- Type-check: `npx tsc -b --noEmit`
- Build: `npm run build`

On Windows PowerShell, if `npm` is blocked by the execution policy, use `npm.cmd run dev`.
