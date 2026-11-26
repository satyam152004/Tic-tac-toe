import { useEffect, useRef, useState } from 'react';
import { isAiTurn } from '../game-engine';
import { useLocalGameStore } from '../store/localGameStore';

export const AI_DELAY_MS = 450;
export const RESULT_DELAY_MS = 700;

/**
 * Drives a running offline game for the board screen:
 *  - ticks the timer once per second while the game runs (not paused / finished)
 *  - schedules the AI reply when it is the AI's turn (cancelled on pause / unmount / state change)
 *  - calls `onFinished` shortly after the round ends so the winning line can be seen
 * Pass `enabled = false` on screens that do not play a local game (the online board): nothing runs then.
 */
export function useLocalGameRunner(onFinished: () => void, enabled = true) {
  const game = useLocalGameStore((s) => s.game);
  const paused = useLocalGameStore((s) => s.paused);
  const [elapsed, setElapsed] = useState(() => useLocalGameStore.getState().elapsedMs());
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const status = game?.outcome.status ?? null;
  const running = enabled && status === 'IN_PROGRESS' && !paused;

  // timer
  useEffect(() => {
    setElapsed(useLocalGameStore.getState().elapsedMs());
    if (!running) return;
    const id = setInterval(() => setElapsed(useLocalGameStore.getState().elapsedMs()), 1000);
    return () => clearInterval(id);
  }, [running, game]);

  // AI turn
  const aiTurn = enabled && !!game && !paused && isAiTurn(game);
  useEffect(() => {
    if (!aiTurn) return;
    // InteractionManager was removed from react-native core (0.88): a plain timer is the supported equivalent.
    const timer = setTimeout(() => useLocalGameStore.getState().aiMove(), AI_DELAY_MS);
    return () => clearTimeout(timer);
  }, [aiTurn, game]);

  // round finished -> let the highlight show, then hand over
  const finished = enabled && status !== null && status !== 'IN_PROGRESS';
  useEffect(() => {
    if (!finished) return;
    const id = setTimeout(() => finishedRef.current(), RESULT_DELAY_MS);
    return () => clearTimeout(id);
  }, [finished, game]);

  return { elapsedMs: elapsed, aiThinking: aiTurn };
}
