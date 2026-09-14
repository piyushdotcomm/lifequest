// Chiptune victory fanfare — synthesized with WebAudio, no audio files.
// A quick arpeggio up + sparkle, in the key of victory.

type Note = { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number };

const N = {
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880,
  B5: 987.77, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093,
  G4: 392, C4: 261.63,
};

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function playNotes(notes: Note[], master = 0.16) {
  const audio = ensureCtx();
  if (!audio) return;
  const t0 = audio.currentTime + 0.01;

  for (const n of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = n.type ?? "square";
    osc.frequency.value = n.freq;
    const peak = n.gain ?? master;
    gain.gain.setValueAtTime(0, t0 + n.start);
    gain.gain.linearRampToValueAtTime(peak, t0 + n.start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + n.start + n.dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + n.start);
    osc.stop(t0 + n.start + n.dur + 0.02);
  }
}

/** Task complete: bright ascending arpeggio (C-E-G-C). */
export function playVictoryFanfare() {
  playNotes([
    { freq: N.C5, start: 0, dur: 0.12 },
    { freq: N.E5, start: 0.09, dur: 0.12 },
    { freq: N.G5, start: 0.18, dur: 0.12 },
    { freq: N.C6, start: 0.27, dur: 0.3, gain: 0.2 },
    { freq: N.E6, start: 0.3, dur: 0.25, type: "triangle", gain: 0.12 },
    { freq: N.G6, start: 0.33, dur: 0.2, type: "triangle", gain: 0.08 },
  ]);
}

/** Level up: the big one — fanfare chord progression with bass. */
export function playLevelUpFanfare() {
  playNotes(
    [
      // bass pulse
      { freq: N.C4, start: 0, dur: 0.28, type: "triangle", gain: 0.22 },
      { freq: N.G4, start: 0.16, dur: 0.3, type: "triangle", gain: 0.18 },
      // triumphant arpeggio
      { freq: N.C5, start: 0.05, dur: 0.14 },
      { freq: N.E5, start: 0.13, dur: 0.14 },
      { freq: N.G5, start: 0.21, dur: 0.14 },
      { freq: N.C6, start: 0.29, dur: 0.16, gain: 0.2 },
      { freq: N.E6, start: 0.36, dur: 0.16, gain: 0.18 },
      { freq: N.G6, start: 0.43, dur: 0.16, gain: 0.16 },
      // final chord
      { freq: N.C6, start: 0.52, dur: 0.55, gain: 0.2 },
      { freq: N.E6, start: 0.52, dur: 0.55, gain: 0.14 },
      { freq: N.G6, start: 0.52, dur: 0.55, gain: 0.12 },
      { freq: N.C7, start: 0.52, dur: 0.6, type: "triangle", gain: 0.1 },
    ],
    0.16
  );
}

/** Purchase: coin clink. */
export function playPurchaseChime() {
  playNotes([
    { freq: N.E6, start: 0, dur: 0.09, type: "triangle", gain: 0.18 },
    { freq: N.C7, start: 0.07, dur: 0.18, type: "triangle", gain: 0.14 },
  ]);
}

/** Error: low buzz. */
export function playErrorBuzz() {
  playNotes([
    { freq: 130.81, start: 0, dur: 0.16, type: "sawtooth", gain: 0.1 },
    { freq: 123.47, start: 0.1, dur: 0.18, type: "sawtooth", gain: 0.09 },
  ]);
}

/** Crit: metal glissando + coin spray — the nat-20 sound. */
export function playCritSting() {
  playNotes(
    [
      { freq: 880, start: 0, dur: 0.09, type: "sawtooth", gain: 0.12 },
      { freq: 1174.66, start: 0.07, dur: 0.09, type: "sawtooth", gain: 0.12 },
      { freq: 1567.98, start: 0.14, dur: 0.12, type: "sawtooth", gain: 0.14 },
      { freq: 2093, start: 0.22, dur: 0.4, type: "square", gain: 0.16 },
      // coin spray
      { freq: N.E6, start: 0.26, dur: 0.08, type: "triangle", gain: 0.14 },
      { freq: N.C7, start: 0.32, dur: 0.08, type: "triangle", gain: 0.12 },
      { freq: 2349.32, start: 0.38, dur: 0.22, type: "triangle", gain: 0.1 },
    ],
    0.16
  );
}

/** Chest open: low creak thud + treasure shimmer. */
export function playChestSound() {
  playNotes(
    [
      { freq: 98, start: 0, dur: 0.22, type: "triangle", gain: 0.22 },
      { freq: 146.83, start: 0.1, dur: 0.18, type: "triangle", gain: 0.16 },
      { freq: N.E6, start: 0.24, dur: 0.1, type: "triangle", gain: 0.12 },
      { freq: N.G6, start: 0.3, dur: 0.1, type: "triangle", gain: 0.1 },
      { freq: N.C7, start: 0.36, dur: 0.3, type: "triangle", gain: 0.12 },
    ],
    0.16
  );
}

/** Retro Pokemon-style map cursor blip. */
export function playMapBlip() {
  playNotes([
    { freq: 880, start: 0, dur: 0.04, type: "square", gain: 0.09 },
    { freq: 1318.5, start: 0.03, dur: 0.06, type: "square", gain: 0.08 },
  ]);
}

/** Route selection chime. */
export function playRouteChirp() {
  playNotes([
    { freq: 659.25, start: 0, dur: 0.05, type: "triangle", gain: 0.12 },
    { freq: 987.77, start: 0.04, dur: 0.07, type: "triangle", gain: 0.12 },
    { freq: 1318.5, start: 0.09, dur: 0.12, type: "square", gain: 0.1 },
  ]);
}

/** Achievement unlock: solemn three-note herald + shimmer. */
export function playAchievementFanfare() {
  playNotes(
    [
      // herald
      { freq: 392, start: 0, dur: 0.16, type: "triangle", gain: 0.18 },
      { freq: 523.25, start: 0.14, dur: 0.16, type: "triangle", gain: 0.18 },
      { freq: 659.25, start: 0.28, dur: 0.3, type: "triangle", gain: 0.2 },
      // shimmer
      { freq: 1318.5, start: 0.34, dur: 0.2, type: "square", gain: 0.08 },
      { freq: 1568, start: 0.42, dur: 0.24, type: "square", gain: 0.08 },
      { freq: 2093, start: 0.5, dur: 0.3, type: "triangle", gain: 0.1 },
    ],
    0.16
  );
}

