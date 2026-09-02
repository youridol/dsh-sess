# Contributing to dsh-sess

Thanks for helping! dsh-sess is an independent plugin for DeepSeek Harness
(dsh-v0.1.2-alpha.5), and its quality bar is high by design: it must stay
strictly on the official API and never depend on the harness implementation
details.

## Ground rules

1. **Official API only.** New behavior must build on public DSH services,
   endpoints, bundles, patches, Cordis and client slots. No harness source
   edits, private APIs, monkey patches, DOM hacks, or version branches.
2. **Behavioral honesty.** Preserve the documented boundaries (cold-only
   deletion, no unarchive, subagent sessions hidden, orphan archive markers).
   If the official API cannot express a feature safely, document that instead
   of working around it.
3. **Tests with every change.** Host operations carry unit tests against faked
   service faces; browser logic lives in pure modules that are unit-tested.
4. **Copy is bilingual.** Every user-visible string exists in `zh` and `en`
   with identical keys (`src/client/locales.ts`).

## Workflow

1. Fork the repository and create a feature branch.
2. Make the change; follow the [development guide](docs/development.en.md).
3. Run the full gate locally:

   ```bash
   npm ci
   npm run check
   ```

4. Add or update `CHANGELOG.en.md` / `CHANGELOG.zh.md`.
5. Open a pull request describing the change, why it is safe on the official
   API, and which tests cover it.

## Reporting issues

Include: DSH version (must be `dsh-v0.1.2-alpha.5`), profile name and bundles,
plugin version, reproduction steps, and the relevant log output. Bug reports
that demonstrate a boundary violation or a data-loss risk get top priority.
