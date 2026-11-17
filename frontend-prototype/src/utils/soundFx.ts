let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      audioCtx = new Ctx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playGameSound(
  type: 'tap' | 'move_x' | 'move_o' | 'win' | 'draw' | 'reward' | 'error',
  enabled: boolean
) {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;

  const now = ctx.currentTime;

  const playTone = (
    freq: number,
    duration: number,
    startOffset = 0,
    wave: OscillatorType = 'sine',
    gainVal = 0.08
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now + startOffset);
    gain.gain.setValueAtTime(gainVal, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration);
  };

  switch (type) {
    case 'tap':
      playTone(440, 0.05, 0, 'sine', 0.04);
      break;
    case 'move_x':
      playTone(587.33, 0.09, 0, 'triangle', 0.08);
      break;
    case 'move_o':
      playTone(493.88, 0.09, 0, 'sine', 0.08);
      break;
    case 'win':
      playTone(523.25, 0.12, 0, 'triangle', 0.09);
      playTone(659.25, 0.12, 0.09, 'triangle', 0.09);
      playTone(783.99, 0.24, 0.18, 'triangle', 0.1);
      break;
    case 'draw':
      playTone(392.0, 0.14, 0, 'sine', 0.07);
      playTone(349.23, 0.18, 0.12, 'sine', 0.07);
      break;
    case 'reward':
      playTone(659.25, 0.1, 0, 'sine', 0.08);
      playTone(880.0, 0.2, 0.09, 'sine', 0.09);
      break;
    case 'error':
      playTone(220, 0.14, 0, 'sawtooth', 0.05);
      break;
  }
}
