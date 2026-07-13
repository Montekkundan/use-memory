# Contributing to use-memory

Thank you for your interest in contributing!

## Reporting Bugs

- Search [existing issues](https://github.com/Montekkundan/use-memory/issues) before opening a new one
- Include steps to reproduce, expected behavior, and actual behavior
- Include your environment (Node version, OS, browser)
- Use the [bug report form](https://github.com/Montekkundan/use-memory/issues/new?template=bug-report.yml)

## Suggesting Features

- Open a [feature request](https://github.com/Montekkundan/use-memory/issues/new?template=feature-request.yml)
- Describe the use case and why it would be valuable to use-memory users
- If possible, outline a proposed implementation

## Development Setup

```bash
git clone https://github.com/Montekkundan/use-memory.git
cd use-memory

pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

Set real values in `.env`. Never commit secrets or `.data/`.

## Project Structure

```
use-memory/
├── agent/          # Eve agent: channels, tools, skills, connections
├── app/            # Nuxt 4 UI: chat, settings, profile
├── server/         # Nitro API, Drizzle schema, auth, memory
├── shared/         # Types and helpers used by app + agent
└── docs/           # Documentation (architecture, env, customization)
```

## Making Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run checks:
   ```bash
   pnpm typecheck
   ```
5. Commit with a [Conventional Commits](https://www.conventionalcommits.org/) message
6. Open a pull request

## Pull Request Process

1. Ensure `pnpm typecheck` passes
2. Update documentation if your change affects user-facing behavior
3. Add a clear description of what changed and why
4. Link related issues when applicable

PR titles must follow Conventional Commits (enforced by CI). Scopes: `app`, `agent`, `server`, `docs`, `deps`.

## Configuring the Agent

See [docs/CUSTOMIZATION.md](./docs/CUSTOMIZATION.md) for branding, model, tool, and integration settings.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
