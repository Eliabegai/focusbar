# FocusBar ⏱

App leve de produtividade para desenvolvedores.  
**Jornada de trabalho · Pomodoro · Cronômetro**  
Fica sempre visível no canto da tela. ~15MB de RAM.

---

## Funcionalidades

### 🗓 Modo Jornada
- Informe o horário que você começou a trabalhar
- Conta automaticamente 8h30 de trabalho
- Barra de progresso visual
- Botão de almoço com contador de 1h separado
- Notificação ao completar a jornada

### 🍅 Modo Pomodoro
- 25 minutos de foco / 5 minutos de pausa (clássico)
- Anel animado com progresso
- Contador de pomodoros completados
- Notificação entre fases

### ⏱ Cronômetro
- Simples e preciso

---

## Pré-requisitos

### Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Node.js 18+
Recomendado via [nvm](https://github.com/nvm-sh/nvm):
```bash
nvm install 18 && nvm use 18
```

### Dependências de sistema (Linux apenas)
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.0-dev build-essential curl wget \
  libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```
> macOS e Windows não precisam de dependências extras.

---

## Instalação & Execução

```bash
# 1. Instalar dependências Node
npm install

# 2. Modo desenvolvimento (com hot-reload)
npm run tauri dev

# 3. Gerar build de produção
npm run tauri build
# O instalador fica em: src-tauri/target/release/bundle/
```

---

## Ícones

Antes de fazer o build final, gere os ícones:
```bash
npm run tauri icon ./public/icon.png
# Coloque um PNG 1024x1024 em public/icon.png primeiro
```

---

## Estrutura do Projeto

```
focusbar/
├── src/                    # React frontend
│   ├── App.tsx             # UI principal
│   ├── App.css             # Estilos
│   ├── useTimer.ts         # Lógica dos timers (hook)
│   ├── main.tsx            # Entry point
│   └── index.css           # Variáveis CSS globais
├── src-tauri/              # Backend Rust/Tauri
│   ├── src/main.rs         # Window + System Tray
│   ├── tauri.conf.json     # Configurações do app
│   └── Cargo.toml          # Dependências Rust
├── package.json
└── vite.config.ts
```

---

## Customizações fáceis

### Mudar duração do Pomodoro
Em `src/useTimer.ts`:
```ts
const POMODORO_FOCUS = 25 * 60; // mude aqui
const POMODORO_BREAK = 5 * 60;  // mude aqui
```

### Mudar jornada padrão
Em `src/useTimer.ts`:
```ts
workday: {
  totalWork: 510,     // minutos (510 = 8h30)
  lunchDuration: 60,  // minutos
}
```

### Mudar posição inicial da janela
Em `src-tauri/src/main.rs`, adicione ao WindowBuilder:
```rust
.position(1600.0, 20.0)  // x, y em pixels
```

---

## Por que Tauri?

| | Electron | Tauri |
|---|---|---|
| RAM (idle) | ~100MB | ~15MB |
| Bundle | ~150MB | ~8MB |
| CPU (idle) | ~2% | ~0.1% |

---

## Dicas de uso

- **Fechar** a janela apenas oculta ela — continua no system tray
- **Clique no ícone** do tray para mostrar/ocultar
- Fica sempre no topo — arraste pela barra superior
- Permite notificações do sistema para os alertas funcionarem
