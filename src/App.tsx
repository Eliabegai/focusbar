import { useEffect, useState } from "react";
import { useTimer, formatTime, formatTimeHM, Mode } from "./useTimer";
import { invoke } from "@tauri-apps/api/tauri";
import "./App.css";

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatClockFromMs(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function App() {
  const {
    state,
    pomodoroElapsedDisplay,
    stopwatchElapsedDisplay,
    stopwatchRemainingDisplay,
    startWorkday,
    toggleLunch,
    toggleLunchDoneManual,
    freezeWorkdayTracking,
    resumeWorkdayTracking,
    applyWorkdayEndTime,
    setMode,
    toggleRunning,
    resetPomodoro,
    resetStopwatch,
    configureStopwatch,
  } = useTimer();

  const [startInput, setStartInput] = useState(getCurrentTime());
  const [workdayStarted, setWorkdayStarted] = useState(false);
  const [trayAlwaysVisible, setTrayAlwaysVisible] = useState(true);
  const [stopwatchRetroMinutes, setStopwatchRetroMinutes] = useState(0);
  const [stopwatchTargetMinutes, setStopwatchTargetMinutes] = useState(0);
  const [workdayEndInput, setWorkdayEndInput] = useState(getCurrentTime());

  const handleStartWorkday = () => {
    startWorkday(startInput);
    setWorkdayStarted(true);
    setWorkdayEndInput(getCurrentTime());
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

  const lunchTargetSec = state.workday.lunchDuration * 60;
  const lunchDoneByTimer =
    lunchTargetSec > 0 && state.lunchElapsed >= lunchTargetSec;
  const lunchDoneEffective =
    state.lunchDoneManual || lunchDoneByTimer;
  const lunchProgress =
    lunchTargetSec > 0
      ? lunchDoneEffective
        ? 1
        : Math.min(state.lunchElapsed / lunchTargetSec, 1)
      : 0;
  const lunchElapsedDisplay = lunchDoneEffective
    ? lunchTargetSec
    : state.lunchElapsed;

  const pomodoroLimit =
    state.pomodoroPhase === "focus" ? 25 * 60 : 5 * 60;
  const pomodoroProgress = Math.min(pomodoroElapsedDisplay / pomodoroLimit, 1);
  const lunchRemaining = lunchDoneEffective
    ? 0
    : Math.max(0, lunchTargetSec - state.lunchElapsed);
  const remaining = Math.max(0, state.workday.totalWork * 60 - state.workdayElapsed) + lunchRemaining;
  const workdaySecondary = workdayStarted
    ? state.workdayComplete
      ? lunchDoneEffective
        ? "Jornada e almoço 100% no app"
        : "Jornada 100% concluida"
      : state.workdayFrozen
      ? `Contagem pausada${state.workdayClosedAtMs ? ` · ref. ${formatClockFromMs(state.workdayClosedAtMs)}` : ""}`
      : state.isOnLunch
      ? `Jornada em pausa (almoco ${Math.round(lunchProgress * 100)}%)`
      : `Jornada ${Math.round(workProgress * 100)}% • falta ${formatTimeHM(Math.max(0, remaining))}`
    : "Sem jornada ativa";
  const primaryStatusText =
    state.mode === "pomodoro"
      ? `${state.pomodoroPhase === "focus" ? "Pomodoro foco" : "Pomodoro pausa"} • ${formatTime(
          Math.max(0, pomodoroLimit - pomodoroElapsedDisplay),
          false
        )}`
      : state.mode === "stopwatch"
      ? `Cronometro • ${
          state.stopwatchTargetSeconds > 0
            ? `restante ${formatTime(stopwatchRemainingDisplay)}`
            : formatTime(stopwatchElapsedDisplay)
        }`
      : state.workdayComplete
      ? "Jornada concluida"
      : state.workdayFrozen
      ? `Contagem pausada · ${formatTime(state.workdayElapsed)}`
      : state.isOnLunch
      ? `Almoco • ${formatTime(state.lunchElapsed)}`
      : `Jornada ativa • ${formatTime(state.workdayElapsed)}`;
  const topStatusText = `${primaryStatusText} • ${workdaySecondary}`;

  useEffect(() => {
    const title = `FocusBar • ${topStatusText}`;
    invoke("update_tray_title", {
      title,
      always_visible: trayAlwaysVisible,
      alwaysVisible: trayAlwaysVisible,
    }).catch((error) => {
      console.error("Falha ao atualizar tray:", error);
    });
  }, [
    state.mode,
    state.workdayElapsed,
    state.lunchElapsed,
    state.lunchDoneManual,
    state.workdayComplete,
    state.workdayFrozen,
    state.workdayClosedAtMs,
    state.isOnLunch,
    pomodoroElapsedDisplay,
    state.pomodoroPhase,
    stopwatchElapsedDisplay,
    workdayStarted,
    workProgress,
    lunchProgress,
    trayAlwaysVisible,
    topStatusText,
  ]);

  useEffect(() => {
    const savedMode = localStorage.getItem("focusbar.tray.alwaysVisible");
    if (savedMode === "0") {
      setTrayAlwaysVisible(false);
      return;
    }
    setTrayAlwaysVisible(true);
  }, []);

  useEffect(() => {
    localStorage.setItem("focusbar.tray.alwaysVisible", trayAlwaysVisible ? "1" : "0");
  }, [trayAlwaysVisible]);


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
      <div className="top-status" title={topStatusText}>{topStatusText}</div>

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
              <div
                className={`big-timer ${state.workdayComplete ? "complete" : state.isOnLunch ? "lunch" : state.workdayFrozen ? "frozen" : "work"}`}
              >
                <div className="timer-label">
                  {state.workdayComplete
                    ? "JORNADA COMPLETA"
                    : state.workdayFrozen
                    ? "CONTAGEM PAUSADA"
                    : state.isOnLunch
                    ? "ALMOÇO"
                    : "TRABALHANDO"}
                </div>
                <div className="timer-display">
                  {state.isOnLunch && !state.workdayFrozen
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
                    {formatTimeHM(lunchElapsedDisplay)} /{" "}
                    {formatTimeHM(lunchTargetSec)}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill lunch"
                    style={{ width: `${lunchProgress * 100}%` }}
                  />
                </div>
                <div className="progress-footer lunch-done-footer">
                  <span className="dim">
                    {lunchDoneEffective
                      ? "✓ Completo!"
                      : `faltam ${formatTimeHM(lunchRemaining)}`}
                  </span>
                  {!lunchDoneByTimer && (
                    <label className="lunch-done-check">
                      <input
                        type="checkbox"
                        checked={state.lunchDoneManual}
                        onChange={toggleLunchDoneManual}
                      />
                      <span>Almoço realizado (manual)</span>
                    </label>
                  )}
                </div>
              </div>

              {!state.workdayComplete && (
                <div className="workday-tracking-panel">
                  <div className="workday-tracking-row">
                    <button
                      type="button"
                      className="btn-control btn-stop-track"
                      onClick={freezeWorkdayTracking}
                      disabled={state.workdayFrozen}
                      title="Congela o relógio no valor atual"
                    >
                      Parar contagem
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-resume-track"
                      onClick={resumeWorkdayTracking}
                      disabled={!state.workdayFrozen}
                      title="Volta a seguir o relógio do sistema"
                    >
                      Retomar
                    </button>
                  </div>
                  <div className="workday-tracking-row workday-end-row">
                    <label className="workday-end-label">
                      <span className="workday-end-caption">Horário de saída / fim</span>
                      <input
                        type="time"
                        value={workdayEndInput}
                        onChange={(e) => setWorkdayEndInput(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-primary btn-apply-end"
                      onClick={() => applyWorkdayEndTime(workdayEndInput)}
                      title="Recalcula trabalho até esse horário (desconta almoço registrado)"
                    >
                      Calcular
                    </button>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="controls">
                <button
                  className={`btn-control ${state.isOnLunch ? "lunch-active" : ""}`}
                  onClick={toggleLunch}
                  disabled={state.workdayComplete || state.workdayFrozen}
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
            {state.stopwatchTargetSeconds > 0
              ? formatTime(stopwatchRemainingDisplay)
              : formatTime(stopwatchElapsedDisplay)}
          </div>
          {state.stopwatchTargetSeconds > 0 && (
            <div className="ring-remaining">
              decorrido {formatTime(stopwatchElapsedDisplay)}
            </div>
          )}
          <div className="setup-row">
            <input
              type="number"
              min={0}
              value={stopwatchRetroMinutes}
              onChange={(e) => setStopwatchRetroMinutes(Number(e.target.value) || 0)}
              placeholder="Retroativo (min)"
            />
            <input
              type="number"
              min={0}
              value={stopwatchTargetMinutes}
              onChange={(e) => setStopwatchTargetMinutes(Number(e.target.value) || 0)}
              placeholder="Meta restante (min)"
            />
            <button
              className="btn-ghost"
              onClick={() =>
                configureStopwatch(
                  stopwatchRetroMinutes * 60,
                  stopwatchTargetMinutes * 60,
                  true
                )
              }
            >
              Aplicar
            </button>
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
              : state.workdayFrozen
              ? "⏸ Contagem pausada"
              : `${Math.round(workProgress * 100)}% da jornada`
            : state.mode === "pomodoro"
            ? `#${state.pomodoroCount + 1}`
            : ""}
        </span>
        <span className="footer-sep">·</span>
        <label className="footer-toggle">
          <input
            type="checkbox"
            checked={trayAlwaysVisible}
            onChange={(e) => setTrayAlwaysVisible(e.target.checked)}
          />
          Tray sempre visível
        </label>
      </div>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(getCurrentTime());
  useEffect(() => {
    const id = setInterval(() => setTime(getCurrentTime()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="live-clock">{time}</span>;
}
