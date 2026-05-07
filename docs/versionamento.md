# Versionamento e releases (dev)

## Regra

- Usar SemVer: `MAJOR.MINOR.PATCH`.
- Fonte principal de versão: `package.json`.
- `src-tauri/tauri.conf.json` deve sempre ter mesma versão.

## Scripts disponíveis

- `npm run version:patch` -> sobe patch e sincroniza Tauri.
- `npm run version:minor` -> sobe minor e sincroniza Tauri.
- `npm run version:major` -> sobe major e sincroniza Tauri.
- `npm run version:sync` -> só sincroniza versão atual no Tauri.
- `npm run release:build` -> build web + build Tauri.

## Fluxo recomendado

1. Finalizar feature e atualizar `CHANGELOG.md` em `Unreleased`.
2. Rodar testes/build local.
3. Escolher tipo de release:
   - bugfix: `npm run version:patch`
   - feature: `npm run version:minor`
   - breaking: `npm run version:major`
4. Revisar se `package.json` e `src-tauri/tauri.conf.json` ficaram iguais.
5. Commit dos arquivos de versão e changelog.
6. Criar tag da release (`vX.Y.Z`) se necessário.
7. Rodar `npm run release:build`.

## Checklist rápido

- [ ] `CHANGELOG.md` atualizado
- [ ] versão sincronizada (`package.json` e `tauri.conf.json`)
- [ ] build local ok
- [ ] commit feito
- [ ] tag criada
