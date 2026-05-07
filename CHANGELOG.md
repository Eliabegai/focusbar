# Changelog

Mudanças importantes deste projeto serão registradas neste arquivo.

Formato inspirado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Painel lateral de configurações para jornada, visibilidade de campos e almoço.
- Exibição da versão atual do app no footer (alinhada à direita, na linha de horário/jornada).
- Script `scripts/sync-version.mjs` para sincronizar versão entre `package.json` e `src-tauri/tauri.conf.json`.
- Documentação de versionamento em `docs/versionamento.md`.
- Configuração de duração do Pomodoro (foco e pausa) no painel lateral.

### Changed
- Fluxo de configuração da v1 consolidado em `FEATURES.md`.
- `README.md` atualizado com seção de versionamento.
- `package.json` com scripts de versionamento e build de release (`version:*`, `version:sync`, `release:build`).
- Timer Pomodoro agora usa durações configuráveis em vez de valores fixos (25/5).
- Notificações do Pomodoro exibem os minutos configurados.

## [0.1.0] - 2026-05-07

### Added
- Base do app FocusBar com modos Jornada, Pomodoro e Cronômetro.
