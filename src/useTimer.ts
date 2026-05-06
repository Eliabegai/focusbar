import { useState, useEffect, useCallback, useRef } from "react";

export type Mode = "workday" | "pomodoro" | "stopwatch";
export type PomodoroPhase = "focus" | "break";

export interface WorkdayConfig {
  startTime: string;       // "HH:MM"
  startTimestamp: number;  // Date.now() real quando iniciou
  totalWork: number;       // minutos (default 510 = 8h30)
  lunchDuration: number;   // minutos (default 60)
}

export interface TimerState {
  mode: Mode;
  isRunning: boolean; // controla pomodoro/cronometro
  // Workday
  workday: WorkdayConfig;
  workdayElapsed: number;  // segundos trabalhados (excluindo almoço)
  lunchElapsed: number;    // segundos de almoço consumidos
  lunchBaseElapsed: number; // acumulado antes do almoço atual
  lunchSessions: number;   // quantas vezes foi almoçar
  isOnLunch: boolean;
  lunchStartTimestamp: number | null; // quando iniciou o almoço atual
  /** Registro manual: barra de almoço 100% sem usar o timer do botão Almoço */
  lunchDoneManual: boolean;
  /** Pausa a contagem pelo relógio (Parar / horário final); Retomar volta a seguir o tempo real */
  workdayFrozen: boolean;
  /** Momento usado ao pausar ou ao aplicar horário final (para exibir no app) */
  workdayClosedAtMs: number | null;
  workdayComplete: boolean;
  // Pomodoro
  pomodoroPhase: PomodoroPhase;
  pomodoroSessionStart: number | null; // timestamp real do início da sessão atual
  pomodoroBaseElapsed: number;         // elapsed acumulado antes de pausar
  pomodoroCount: number;
  // Stopwatch
  stopwatchBaseElapsed: number;        // elapsed acumulado antes de pausar
  stopwatchSessionStart: number | null; // timestamp real do início
  stopwatchTargetSeconds: number; // 0 = sem regressivo
}

const POMODORO_FOCUS = 25 * 60;
const POMODORO_BREAK = 5 * 60;

// Calcula elapsed real de trabalho desde o início, descontando almoços já tirados
function calcWorkElapsed(
  startTimestamp: number,
  lunchElapsedAlready: number,
  isOnLunch: boolean,
  lunchStartTimestamp: number | null,
  nowMs: number = Date.now()
): number {
  const totalRaw = Math.floor((nowMs - startTimestamp) / 1000);
  let lunchSoFar = lunchElapsedAlready;
  if (isOnLunch && lunchStartTimestamp) {
    lunchSoFar += Math.floor((nowMs - lunchStartTimestamp) / 1000);
  }
  return Math.max(0, totalRaw - lunchSoFar);
}

/** Congela almoço/trabalho como num instante fixo (fecha sessão de almoço no estado). */
function snapshotWorkdayAt(prev: TimerState, nowMs: number) {
  const cap = prev.workday.lunchDuration * 60;
  let lunchElapsed = prev.lunchElapsed;
  const lunchStartTs = prev.lunchStartTimestamp;

  if (prev.isOnLunch && lunchStartTs !== null) {
    lunchElapsed =
      prev.lunchBaseElapsed + Math.floor((nowMs - lunchStartTs) / 1000);
    if (lunchElapsed >= cap) {
      lunchElapsed = cap;
    }
  }

  lunchElapsed = Math.min(Math.max(0, lunchElapsed), cap);

  const raw = Math.floor((nowMs - prev.workday.startTimestamp) / 1000);
  const workSeconds = Math.max(0, raw - lunchElapsed);
  const totalRequired = prev.workday.totalWork * 60;
  const workdayComplete = workSeconds >= totalRequired;

  return {
    workdayElapsed: workdayComplete ? totalRequired : workSeconds,
    lunchElapsed,
    lunchBaseElapsed: lunchElapsed,
    isOnLunch: false,
    lunchStartTimestamp: null as number | null,
    workdayComplete,
  };
}

function parseTodayEndMs(startTimestamp: number, endTimeHHMM: string): number | null {
  const parts = endTimeHHMM.trim().split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

  const end = new Date();
  end.setHours(h, m, 0, 0);
  let endMs = end.getTime();
  const now = Date.now();
  if (endMs > now) endMs = now;
  if (endMs < startTimestamp) {
    end.setDate(end.getDate() + 1);
    endMs = Math.min(end.getTime(), now);
  }
  if (endMs < startTimestamp) return null;
  return endMs;
}

export function useTimer() {
  const [state, setState] = useState<TimerState>({
    mode: "workday",
    isRunning: false,
    workday: {
      startTime: "",
      startTimestamp: 0,
      totalWork: 510,
      lunchDuration: 60,
    },
    workdayElapsed: 0,
    lunchElapsed: 0,
    lunchBaseElapsed: 0,
    lunchSessions: 0,
    isOnLunch: false,
    lunchStartTimestamp: null,
    lunchDoneManual: false,
    workdayFrozen: false,
    workdayClosedAtMs: null,
    workdayComplete: false,
    pomodoroPhase: "focus",
    pomodoroSessionStart: null,
    pomodoroBaseElapsed: 0,
    pomodoroCount: 0,
    stopwatchBaseElapsed: 0,
    stopwatchSessionStart: null,
    stopwatchTargetSeconds: 0,
  });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());

  const notify = useCallback((title: string, body: string, key: string) => {
    if (notifiedRef.current.has(key)) return;
    notifiedRef.current.add(key);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, silent: false });
    }
  }, []);

  // Tick: só atualiza o state lendo timestamps reais — nunca acumula +1
  const tick = useCallback(() => {
    setState((prev) => {
      // --- WORKDAY ---
      if (prev.workday.startTimestamp && !prev.workdayComplete) {
        if (prev.workdayComplete || !prev.workday.startTimestamp) return prev;
        if (prev.workdayFrozen) return prev;

        // Almoço em andamento: atualiza lunchElapsed em tempo real
        let newLunchElapsed = prev.lunchElapsed;
        if (prev.isOnLunch && prev.lunchStartTimestamp) {
          newLunchElapsed =
            prev.lunchBaseElapsed +
            Math.floor((Date.now() - prev.lunchStartTimestamp) / 1000);

          // Almoço acabou automaticamente?
          if (newLunchElapsed >= prev.workday.lunchDuration * 60) {
            setTimeout(
              () =>
                notify(
                  "☕ Almoço encerrado!",
                  "De volta ao trabalho.",
                  "lunch-end"
                ),
              0
            );
            return {
              ...prev,
              lunchElapsed: prev.workday.lunchDuration * 60,
              lunchBaseElapsed: prev.workday.lunchDuration * 60,
              isOnLunch: false,
              lunchStartTimestamp: null,
            };
          }

          // Ainda no almoço — só atualiza lunchElapsed, não workdayElapsed
          return { ...prev, lunchElapsed: newLunchElapsed };
        }

        // Calcula trabalho real descontando almoço
        const newWorkElapsed = calcWorkElapsed(
          prev.workday.startTimestamp,
          prev.lunchElapsed,
          false,
          null,
          Date.now()
        );

        const totalRequired = prev.workday.totalWork * 60;

        // Jornada completa?
        if (newWorkElapsed >= totalRequired) {
          setTimeout(
            () =>
              notify(
                "🎉 Jornada completa!",
                "Você bateu suas 8h30 hoje!",
                "workday-end"
              ),
            0
          );
          return {
            ...prev,
            workdayElapsed: totalRequired,
            workdayComplete: true,
          };
        }

        // Lembrete de almoço na metade
        if (
          prev.lunchSessions === 0 &&
          newWorkElapsed >= Math.floor(totalRequired * 0.5) &&
          newWorkElapsed < Math.floor(totalRequired * 0.5) + 60
        ) {
          setTimeout(
            () =>
              notify(
                "🍽️ Hora do almoço?",
                "Você está na metade da jornada.",
                "lunch-mid"
              ),
            0
          );
        }

        return { ...prev, workdayElapsed: newWorkElapsed };
      }

      // --- STOPWATCH ---
      if (prev.isRunning && prev.mode === "stopwatch") {
        if (!prev.stopwatchSessionStart) return prev;
        const elapsed =
          prev.stopwatchBaseElapsed +
          Math.floor((Date.now() - prev.stopwatchSessionStart) / 1000);
        return { ...prev, stopwatchElapsed: elapsed } as typeof prev & { stopwatchElapsed: number };
      }

      // --- POMODORO ---
      if (prev.isRunning && prev.mode === "pomodoro") {
        if (!prev.pomodoroSessionStart) return prev;
        const elapsed =
          prev.pomodoroBaseElapsed +
          Math.floor((Date.now() - prev.pomodoroSessionStart) / 1000);
        const limit =
          prev.pomodoroPhase === "focus" ? POMODORO_FOCUS : POMODORO_BREAK;

        if (elapsed >= limit) {
          const newPhase: PomodoroPhase =
            prev.pomodoroPhase === "focus" ? "break" : "focus";
          const newCount =
            prev.pomodoroPhase === "focus"
              ? prev.pomodoroCount + 1
              : prev.pomodoroCount;
          setTimeout(() => {
            if (newPhase === "break") {
              notify(
                "🍅 Pomodoro completo!",
                "Hora de descansar 5 minutos.",
                `pomo-break-${newCount}`
              );
            } else {
              notify(
                "✅ Pausa encerrada!",
                "Bora focar por mais 25 min.",
                `pomo-focus-${newCount}`
              );
            }
          }, 0);
          return {
            ...prev,
            pomodoroPhase: newPhase,
            pomodoroBaseElapsed: 0,
            pomodoroSessionStart: Date.now(),
            pomodoroCount: newCount,
          };
        }

        return { ...prev, pomodoroElapsed: elapsed } as typeof prev & { pomodoroElapsed: number };
      }

      return prev;
    });
  }, [notify]);

  // Intervalo de 1s — mas o valor real vem sempre do timestamp, não do contador
  useEffect(() => {
    tickRef.current = setInterval(tick, 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [tick]);

  // Permissão de notificação
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Visibilidade: quando volta ao foco, força um tick imediato
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [tick]);

  // ── ACTIONS ──

  const startWorkday = useCallback((startTime: string) => {
    notifiedRef.current.clear();

    const [h, m] = startTime.split(":").map(Number);
    const today = new Date();
    today.setHours(h, m, 0, 0);
    const startTimestamp = today.getTime();

    // Calcula quanto já trabalhou desde o horário informado
    const rawElapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    const alreadyWorked = Math.max(0, rawElapsed);

    setState((prev) => ({
      ...prev,
      mode: "workday",
      isRunning: false,
      workday: { ...prev.workday, startTime, startTimestamp },
      workdayElapsed: Math.min(alreadyWorked, prev.workday.totalWork * 60),
      lunchElapsed: 0,
      lunchBaseElapsed: 0,
      lunchSessions: 0,
      isOnLunch: false,
      lunchStartTimestamp: null,
      lunchDoneManual: false,
      workdayFrozen: false,
      workdayClosedAtMs: null,
      workdayComplete: false,
    }));
  }, []);

  const freezeWorkdayTracking = useCallback(() => {
    const now = Date.now();
    setState((prev) => {
      if (
        !prev.workday.startTimestamp ||
        prev.workdayComplete ||
        prev.workdayFrozen
      ) {
        return prev;
      }
      const snap = snapshotWorkdayAt(prev, now);
      return {
        ...prev,
        ...snap,
        workdayFrozen: true,
        workdayClosedAtMs: now,
      };
    });
  }, []);

  const resumeWorkdayTracking = useCallback(() => {
    setState((prev) => {
      if (!prev.workdayFrozen || prev.workdayComplete) return prev;
      return {
        ...prev,
        workdayFrozen: false,
        workdayClosedAtMs: null,
      };
    });
  }, []);

  const applyWorkdayEndTime = useCallback((endTimeHHMM: string) => {
    setState((prev) => {
      if (!prev.workday.startTimestamp || prev.workdayComplete) return prev;
      const endMs = parseTodayEndMs(prev.workday.startTimestamp, endTimeHHMM);
      if (endMs === null) return prev;
      const snap = snapshotWorkdayAt(prev, endMs);
      return {
        ...prev,
        ...snap,
        workdayFrozen: true,
        workdayClosedAtMs: endMs,
      };
    });
  }, []);

  const toggleLunchDoneManual = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lunchDoneManual: !prev.lunchDoneManual,
    }));
  }, []);

  const toggleLunch = useCallback(() => {
    setState((prev) => {
      if (prev.workdayFrozen || prev.workdayComplete) return prev;
      if (prev.isOnLunch) {
        // Voltando do almoço: congela o lunchElapsed
        const lunchSoFar = prev.lunchStartTimestamp
          ? prev.lunchBaseElapsed +
            Math.floor((Date.now() - prev.lunchStartTimestamp) / 1000)
          : prev.lunchElapsed;
        return {
          ...prev,
          isOnLunch: false,
          lunchStartTimestamp: null,
          lunchElapsed: Math.min(lunchSoFar, prev.workday.lunchDuration * 60),
          lunchBaseElapsed: Math.min(lunchSoFar, prev.workday.lunchDuration * 60),
        };
      } else {
        // Saindo para almoço: marca o timestamp de início
        return {
          ...prev,
          isOnLunch: true,
          lunchBaseElapsed: prev.lunchElapsed,
          lunchStartTimestamp: Date.now(),
          lunchSessions: prev.lunchSessions + 1,
        };
      }
    });
  }, []);

  const setMode = useCallback((mode: Mode) => {
    setState((prev) => ({
      ...prev,
      mode,
      isRunning: false,
      pomodoroBaseElapsed: 0,
      pomodoroSessionStart: null,
      pomodoroPhase: "focus",
      stopwatchBaseElapsed: 0,
      stopwatchSessionStart: null,
    }));
    notifiedRef.current.clear();
  }, []);

  const toggleRunning = useCallback(() => {
    setState((prev) => {
      if (prev.mode === "workday") return prev;
      if (prev.isRunning) {
        // Pausando: congela base
        if (prev.mode === "pomodoro") {
          const elapsed = prev.pomodoroSessionStart
            ? prev.pomodoroBaseElapsed +
              Math.floor((Date.now() - prev.pomodoroSessionStart) / 1000)
            : prev.pomodoroBaseElapsed;
          return {
            ...prev,
            isRunning: false,
            pomodoroBaseElapsed: elapsed,
            pomodoroSessionStart: null,
          };
        }
        if (prev.mode === "stopwatch") {
          const elapsed = prev.stopwatchSessionStart
            ? prev.stopwatchBaseElapsed +
              Math.floor((Date.now() - prev.stopwatchSessionStart) / 1000)
            : prev.stopwatchBaseElapsed;
          return {
            ...prev,
            isRunning: false,
            stopwatchBaseElapsed: elapsed,
            stopwatchSessionStart: null,
          };
        }
        return { ...prev, isRunning: false };
      } else {
        // Retomando: marca novo sessionStart
        if (prev.mode === "pomodoro") {
          return {
            ...prev,
            isRunning: true,
            pomodoroSessionStart: Date.now(),
          };
        }
        if (prev.mode === "stopwatch") {
          return {
            ...prev,
            isRunning: true,
            stopwatchSessionStart: Date.now(),
          };
        }
        return { ...prev, isRunning: true };
      }
    });
  }, []);

  const resetPomodoro = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pomodoroBaseElapsed: 0,
      pomodoroSessionStart: null,
      pomodoroPhase: "focus",
      pomodoroCount: 0,
      isRunning: false,
    }));
    notifiedRef.current.clear();
  }, []);

  const resetStopwatch = useCallback(() => {
    setState((prev) => ({
      ...prev,
      stopwatchBaseElapsed: 0,
      stopwatchSessionStart: null,
      stopwatchTargetSeconds: 0,
      isRunning: false,
    }));
  }, []);

  const configureStopwatch = useCallback(
    (retroactiveSeconds: number, targetSeconds: number, startNow: boolean) => {
      const safeRetroactive = Math.max(0, Math.floor(retroactiveSeconds));
      const safeTarget = Math.max(0, Math.floor(targetSeconds));
      setState((prev) => ({
        ...prev,
        stopwatchBaseElapsed: safeRetroactive,
        stopwatchTargetSeconds: safeTarget,
        stopwatchSessionStart: startNow ? Date.now() : null,
        isRunning: startNow ? prev.mode === "stopwatch" : false,
      }));
    },
    []
  );

  const updateWorkdayConfig = useCallback((config: Partial<WorkdayConfig>) => {
    setState((prev) => ({
      ...prev,
      workday: { ...prev.workday, ...config },
    }));
  }, []);

  // Computed: elapsed real para exibição
  const pomodoroElapsedDisplay =
    state.isRunning && state.pomodoroSessionStart
      ? state.pomodoroBaseElapsed +
        Math.floor((Date.now() - state.pomodoroSessionStart) / 1000)
      : state.pomodoroBaseElapsed;

  const stopwatchElapsedDisplay =
    state.isRunning && state.stopwatchSessionStart
      ? state.stopwatchBaseElapsed +
        Math.floor((Date.now() - state.stopwatchSessionStart) / 1000)
      : state.stopwatchBaseElapsed;
  const stopwatchRemainingDisplay =
    state.stopwatchTargetSeconds > 0
      ? Math.max(0, state.stopwatchTargetSeconds - stopwatchElapsedDisplay)
      : 0;

  return {
    state,
    pomodoroElapsedDisplay,
    stopwatchElapsedDisplay,
    stopwatchRemainingDisplay,
    startWorkday,
    toggleLunch,
    setMode,
    toggleRunning,
    resetPomodoro,
    resetStopwatch,
    configureStopwatch,
    updateWorkdayConfig,
    toggleLunchDoneManual,
    freezeWorkdayTracking,
    resumeWorkdayTracking,
    applyWorkdayEndTime,
  };
}

export function formatTime(seconds: number, showHours = true): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (showHours) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function formatTimeHM(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h${String(m).padStart(2, "0")}`;
}