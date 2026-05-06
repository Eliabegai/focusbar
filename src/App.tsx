import { useEffect, useState } from "react";
import { useTimer, formatTime, formatTimeHM, Mode } from "./useTimer";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export default function App() {
  const {
    state,
    pomodoroElapsedDisplay,
    stopwatchElapsedDisplay,
    startWorkday,
    toggleLunch,
    setMode,
    toggleRunning,
    resetPomodoro,
    resetStopwatch,
  } = useTimer();

  const [startInput, setStartInput] = useState(getCurrentTime());
  const [workdayStarted, setWorkdayStarted] = useState(false);

  const handleStartWorkday = () => {
    startWorkday(startInput);
    setWorkdayStarted(true);
  };

  function calcExitTime(
    startTime: string,
    totalWorkMin: number,
    lunchMin: number
  ): string {
    const [h, m] = startTime.split(":").map(Number);
    const startSec = h * 3600 + m * 60;
    const totalSec = startSec + totalWorkMin * 60 + lunchMin * 60;
    const exitH = Math.floor(totalSec / 3600) % 24;
    const exitM = Math.floor((totalSec % 3600) / 60);
    return `${String(exitH).padStart(2, "0")}:${String(exitM).padStart(2, "0")}`;
  }

  const workProgress =
    state.workday.totalWork > 0
      ? Math.min(state.workdayElapsed / (state.workday.totalWork * 60), 1)
      : 0;

  const lunchProgress =
    state.workday.lunchDuration > 0
      ? Math.min(state.lunchElapsed / (state.workday.lunchDuration * 60), 1)
      : 0;

  const pomodoroLimit =
    state.pomodoroPhase === "focus" ? 25 * 60 : 5 * 60;
  const pomodoroProgress = Math.min(pomodoroElapsedDisplay / pomodoroLimit, 1);

  // SUBSTITUA POR:
  const lunchRemaining = Math.max(0, state.workday.lunchDuration * 60 - state.lunchElapsed);
  const remaining = Math.max(0, state.workday.totalWork * 60 - state.workdayElapsed) + lunchRemaining;
  // const remaining = state.workday.totalWork * 60 - state.workdayElapsed;

  useEffect(() => {
    let title = "FocusBar";

    if (state.mode === "workday" && workdayStarted) {
      const progress = Math.round(workProgress * 100);
      if (state.workdayComplete) {
        title = "FocusBar • Jornada completa (100%)";
      } else if (state.isOnLunch) {
        title = `FocusBar • Almoco ${formatTime(state.lunchElapsed)} (${Math.round(lunchProgress * 100)}%)`;
      } else {
        title = `FocusBar • Jornada ${formatTime(state.workdayElapsed)} (${progress}%)`;
      }
    } else if (state.mode === "pomodoro") {
      const limit = state.pomodoroPhase === "focus" ? 25 * 60 : 5 * 60;
      const elapsed = pomodoroElapsedDisplay;
      const remainingPomo = Math.max(0, limit - elapsed);
      const phaseLabel = state.pomodoroPhase === "focus" ? "Foco" : "Pausa";
      title = `FocusBar • ${phaseLabel} -${formatTime(remainingPomo, false)} (${Math.round((elapsed / limit) * 100)}%)`;
    } else if (state.mode === "stopwatch") {
      title = `FocusBar • Cronometro ${formatTime(stopwatchElapsedDisplay)}`;
    }

    invoke("update_tray_title", { title }).catch(() => {
      // Ignora erro fora do contexto Tauri (ex.: navegador)
    });
  }, [
    state.mode,
    state.workdayElapsed,
    state.lunchElapsed,
    state.workdayComplete,
    state.isOnLunch,
    pomodoroElapsedDisplay,
    state.pomodoroPhase,
    stopwatchElapsedDisplay,
    workdayStarted,
    workProgress,
    lunchProgress,
  ]);


  return (
    <div className="app" data-tauri-drag-region>
      {/* Header */}
      <div className="header" data-tauri-drag-region>
        <div className="logo">
          <span className="logo-dot" />
          <span className="logo-text">focusbar</span>
        </div>
        <div className="mode-tabs">
          {(["workday", "pomodoro", "stopwatch"] as Mode[]).map((m) => (
            <button
              key={m}
              className={`tab ${state.mode === m ? "active" : ""} tab-${m}`}
              onClick={() => setMode(m)}
            >
              {m === "workday" ? "Jornada" : m === "pomodoro" ? "Pomodoro" : "Crônom."}
            </button>
          ))}
        </div>
      </div>

      {/* WORKDAY MODE */}
      {state.mode === "workday" && (
        <div className="panel">
          {!workdayStarted ? (
            <div className="setup-panel">
              <p className="setup-label">Que horas você começou?</p>
              <div className="setup-row">
                <input
                  type="time"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                />
                <button className="btn-primary" onClick={handleStartWorkday}>
                  Iniciar
                </button>
              </div>
              <div className="setup-meta">
                <span>8h30 trabalho · 1h almoço</span>
              </div>
            </div>
          ) : (
            <>
              {/* Big Timer */}
              <div className={`big-timer ${state.workdayComplete ? "complete" : state.isOnLunch ? "lunch" : "work"}`}>
                <div className="timer-label">
                  {state.workdayComplete
                    ? "JORNADA COMPLETA"
                    : state.isOnLunch
                    ? "ALMOÇO"
                    : "TRABALHANDO"}
                </div>
                <div className="timer-display">
                  {state.isOnLunch
                    ? formatTime(state.lunchElapsed)
                    : formatTime(state.workdayElapsed)}
                </div>
              </div>

              {!state.workdayComplete && (
                <div className="exit-time">
                  <span className="exit-label">SAÍDA PREVISTA</span>
                  <span className="exit-value">
                    {calcExitTime(
                      state.workday.startTime,
                      state.workday.totalWork,
                      state.workday.lunchDuration
                    )}
                  </span>
                </div>
              )}

              {/* Progress bar - work */}
              <div className="progress-block">
                <div className="progress-header">
                  <span className="progress-name">Jornada</span>
                  <span className="progress-val">
                    {formatTimeHM(state.workdayElapsed)} / {formatTimeHM(state.workday.totalWork * 60)}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill work"
                    style={{ width: `${workProgress * 100}%` }}
                  />
                </div>
                <div className="progress-footer">
                  <span className="dim">
                    {state.workdayComplete
                      ? "✓ Completo!"
                      : `faltam ${formatTimeHM(Math.max(0, remaining))}`}
                  </span>
                </div>
              </div>

              {/* Progress bar - lunch */}
              <div className="progress-block">
                <div className="progress-header">
                  <span className="progress-name">Almoço</span>
                  <span className="progress-val">
                    {formatTimeHM(state.lunchElapsed)} / 1h00
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill lunch"
                    style={{ width: `${lunchProgress * 100}%` }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="controls">
                <button
                  className={`btn-control ${state.isRunning ? "active" : ""}`}
                  onClick={toggleRunning}
                  disabled={state.workdayComplete}
                >
                  {state.isRunning ? "⏸ Pausar" : "▶ Continuar"}
                </button>
                <button
                  className={`btn-control ${state.isOnLunch ? "lunch-active" : ""}`}
                  onClick={toggleLunch}
                  disabled={state.workdayComplete}
                >
                  {state.isOnLunch ? "✓ Voltei" : "🍽 Almoço"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => { setWorkdayStarted(false); setMode("workday"); }}
                >
                  Reiniciar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* POMODORO MODE */}
      {state.mode === "pomodoro" && (
        <div className="panel">
          <div className={`pomo-phase-badge ${state.pomodoroPhase}`}>
            {state.pomodoroPhase === "focus" ? "🍅 FOCO" : "☕ PAUSA"}
          </div>

          {/* Ring timer */}
          <div className="ring-wrapper">
            <svg className="ring-svg" viewBox="0 0 120 120">
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke="var(--bg-3)"
                strokeWidth="6"
              />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                stroke={state.pomodoroPhase === "focus" ? "var(--accent-pomo)" : "var(--accent-break)"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - pomodoroProgress)}`}
                transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
            <div className="ring-time">
              {formatTime(pomodoroElapsedDisplay, false)}
            </div>
            <div className="ring-remaining">
              -{formatTime(Math.max(0, pomodoroLimit - pomodoroElapsedDisplay), false)} restando
            </div>
          </div>

          <div className="pomo-count">
            {Array.from({ length: Math.min(state.pomodoroCount, 8) }).map((_, i) => (
              <span key={i} className="pomo-dot done" />
            ))}
            {state.pomodoroCount < 8 && <span className="pomo-dot current" />}
            <span className="pomo-count-label">{state.pomodoroCount} completos</span>
          </div>

          <div className="controls">
            <button
              className={`btn-control pomo ${state.isRunning ? "active" : ""}`}
              onClick={toggleRunning}
            >
              {state.isRunning ? "⏸ Pausar" : "▶ Iniciar"}
            </button>
            <button className="btn-ghost" onClick={resetPomodoro}>
              Resetar
            </button>
          </div>
        </div>
      )}

      {/* STOPWATCH MODE */}
      {state.mode === "stopwatch" && (
        <div className="panel">
          <div className="stopwatch-label">CRONÔMETRO</div>
          <div className="stopwatch-display">
            {formatTime(stopwatchElapsedDisplay)}
          </div>
          <div className="controls">
            <button
              className={`btn-control stop ${state.isRunning ? "active" : ""}`}
              onClick={toggleRunning}
            >
              {state.isRunning ? "⏸ Pausar" : "▶ Iniciar"}
            </button>
            <button className="btn-ghost" onClick={resetStopwatch}>
              Zerar
            </button>
          </div>
        </div>
      )}

      {/* Footer clock */}
      <div className="footer">
        <LiveClock />
        <span className="footer-sep">·</span>
        <span className="footer-dim">
          {state.mode === "workday" && workdayStarted
            ? state.workdayComplete
              ? "✓ Jornada ok"
              : `${Math.round(workProgress * 100)}% da jornada`
            : state.mode === "pomodoro"
            ? `#${state.pomodoroCount + 1}`
            : ""}
        </span>
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(getCurrentTime());
  useState(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 1000);
    return () => clearInterval(id);
  });
  return <span className="live-clock">{time}</span>;
}
