import { useEffect, useState } from "react";
import { useTimer, formatTime, formatTimeHM, Mode } from "./useTimer";
import { invoke } from "@tauri-apps/api/tauri";
import { getVersion } from "@tauri-apps/api/app";
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
    updateWorkdayConfig,
    updatePomodoroConfig,
  } = useTimer();

  const [startInput, setStartInput] = useState(getCurrentTime());
  const [workdayStarted, setWorkdayStarted] = useState(false);
  const [trayAlwaysVisible, setTrayAlwaysVisible] = useState(true);
  const [stopwatchRetroMinutes, setStopwatchRetroMinutes] = useState(0);
  const [stopwatchTargetMinutes, setStopwatchTargetMinutes] = useState(0);
  const [workdayEndInput, setWorkdayEndInput] = useState(getCurrentTime());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workdayHoursInput, setWorkdayHoursInput] = useState(
    String(Math.floor(state.workday.totalWork / 60))
  );
  const [workdayMinutesInput, setWorkdayMinutesInput] = useState(
    String(state.workday.totalWork % 60)
  );
  const [settingsError, setSettingsError] = useState("");
  const [visibleFields, setVisibleFields] = useState({
    topStatus: true,
    exitForecast: true,
    workProgress: true,
    footerInfo: true,
  });
  const [showLunchField, setShowLunchField] = useState(state.workday.lunchDuration > 0);
  const [appVersion, setAppVersion] = useState("...");
  const [pomodoroFocusMinutesInput, setPomodoroFocusMinutesInput] = useState(
    String(Math.floor(state.pomodoroFocusSeconds / 60))
  );
  const [pomodoroBreakMinutesInput, setPomodoroBreakMinutesInput] = useState(
    String(Math.floor(state.pomodoroBreakSeconds / 60))
  );

  const handleStartWorkday = () => {
    startWorkday(startInput);
    setWorkdayStarted(true);
    setWorkdayEndInput(getCurrentTime());
  };

  const applySettings = () => {
    const safeHours = Number(workdayHoursInput);
    const safeMinutes = Number(workdayMinutesInput);
    if (!Number.isFinite(safeHours) || !Number.isFinite(safeMinutes)) {
      setSettingsError("Informe horas e minutos válidos.");
      return;
    }
    if (safeHours < 0 || safeMinutes < 0 || safeMinutes > 59) {
      setSettingsError("Use horas >= 0 e minutos entre 0 e 59.");
      return;
    }

    const totalMinutes = safeHours * 60 + safeMinutes;
    if (totalMinutes < 30 || totalMinutes > 960) {
      setSettingsError("A jornada deve ficar entre 30 min e 16h.");
      return;
    }

    const safePomoFocus = Number(pomodoroFocusMinutesInput);
    const safePomoBreak = Number(pomodoroBreakMinutesInput);
    if (!Number.isFinite(safePomoFocus) || !Number.isFinite(safePomoBreak)) {
      setSettingsError("Pomodoro: informe minutos válidos para foco e pausa.");
      return;
    }
    if (safePomoFocus < 1 || safePomoFocus > 180 || safePomoBreak < 1 || safePomoBreak > 60) {
      setSettingsError("Pomodoro: foco 1-180 min e pausa 1-60 min.");
      return;
    }

    setSettingsError("");
    updateWorkdayConfig({
      totalWork: totalMinutes,
      lunchDuration: showLunchField ? 60 : 0,
    });
    updatePomodoroConfig(safePomoFocus * 60, safePomoBreak * 60);
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
    state.pomodoroPhase === "focus"
      ? state.pomodoroFocusSeconds
      : state.pomodoroBreakSeconds;
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

  useEffect(() => {
    getVersion()
      .then((version) => setAppVersion(version))
      .catch(() => setAppVersion("n/a"));
  }, []);


  return (
    <div className="app" data-tauri-drag-region>
      {/* Header */}
      <div className="header" data-tauri-drag-region>
        <div className="logo">
          <span className="logo-dot" />
          <span className="logo-text">focusbar</span>
        </div>
        <div className="header-actions">
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
          <button
            type="button"
            className={`settings-btn ${settingsOpen ? "active" : ""}`}
            onClick={() => setSettingsOpen((prev) => !prev)}
          >
            Config
          </button>
        </div>
      </div>
      {visibleFields.topStatus && (
        <div className="top-status" title={topStatusText}>
          {topStatusText}
        </div>
      )}

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

              {!state.workdayComplete && visibleFields.exitForecast && (
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
              {visibleFields.workProgress && (
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
              )}

              {/* Progress bar - lunch */}
              {showLunchField && (
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
              )}

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
                {showLunchField && (
                  <button
                    className={`btn-control ${state.isOnLunch ? "lunch-active" : ""}`}
                    onClick={toggleLunch}
                    disabled={state.workdayComplete || state.workdayFrozen}
                  >
                    {state.isOnLunch ? "✓ Voltei" : "🍽 Almoço"}
                  </button>
                )}
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
          <div className="pomo-config-summary">
            {Math.floor(state.pomodoroFocusSeconds / 60)} min foco · {Math.floor(state.pomodoroBreakSeconds / 60)} min pausa
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
        {visibleFields.footerInfo && (
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
        )}
        <span className="footer-version" title={`Versão ${appVersion}`}>
          v{appVersion}
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

      {settingsOpen && (
        <aside className="settings-panel">
          <div className="settings-head">
            <h3>Configurações</h3>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setSettingsOpen(false)}
            >
              Fechar
            </button>
          </div>

          <div className="settings-group">
            <p className="settings-label">Jornada desejada</p>
            <div className="settings-time-row">
              <input
                type="number"
                min={0}
                max={16}
                value={workdayHoursInput}
                onChange={(e) => setWorkdayHoursInput(e.target.value)}
                aria-label="Horas de jornada"
              />
              <span>h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={workdayMinutesInput}
                onChange={(e) => setWorkdayMinutesInput(e.target.value)}
                aria-label="Minutos de jornada"
              />
              <span>min</span>
            </div>
          </div>

          <div className="settings-group">
            <p className="settings-label">Campos visíveis</p>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={visibleFields.topStatus}
                onChange={(e) =>
                  setVisibleFields((prev) => ({ ...prev, topStatus: e.target.checked }))
                }
              />
              Status superior
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={visibleFields.exitForecast}
                onChange={(e) =>
                  setVisibleFields((prev) => ({ ...prev, exitForecast: e.target.checked }))
                }
              />
              Saída prevista
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={visibleFields.workProgress}
                onChange={(e) =>
                  setVisibleFields((prev) => ({ ...prev, workProgress: e.target.checked }))
                }
              />
              Progresso da jornada
            </label>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={visibleFields.footerInfo}
                onChange={(e) =>
                  setVisibleFields((prev) => ({ ...prev, footerInfo: e.target.checked }))
                }
              />
              Resumo no rodapé
            </label>
          </div>

          <div className="settings-group">
            <p className="settings-label">Almoço</p>
            <label className="settings-check">
              <input
                type="checkbox"
                checked={showLunchField}
                onChange={(e) => setShowLunchField(e.target.checked)}
              />
              Mostrar campo de almoço
            </label>
          </div>

          <div className="settings-group">
            <p className="settings-label">Pomodoro</p>
            <div className="settings-time-row">
              <input
                type="number"
                min={1}
                max={180}
                value={pomodoroFocusMinutesInput}
                onChange={(e) => setPomodoroFocusMinutesInput(e.target.value)}
                aria-label="Minutos de foco pomodoro"
              />
              <span>foco</span>
              <input
                type="number"
                min={1}
                max={60}
                value={pomodoroBreakMinutesInput}
                onChange={(e) => setPomodoroBreakMinutesInput(e.target.value)}
                aria-label="Minutos de pausa pomodoro"
              />
              <span>pausa</span>
            </div>
          </div>

          {settingsError && <p className="settings-error">{settingsError}</p>}

          <button type="button" className="btn-primary settings-apply" onClick={applySettings}>
            Aplicar configurações
          </button>
        </aside>
      )}
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
