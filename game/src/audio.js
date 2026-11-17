// Synthesised sound only (WebAudio, no audio files): an engine hum that follows the
// car's speed, a two-tone siren while wanted, pickup blips, a punch thud, a mission
// jingle and a soft chord-pad loop. M toggles mute. Nothing starts until a click.
export function createAudio() {
  const audio = {
    ctx: null, master: null, engine: null, engineGain: null, engineFilter: null,
    siren: null, sirenGain: null, sirenHigh: false, sirenNext: 0,
    pad: null, muted: false,
    ensure() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      let ctx;
      try {
        ctx = new Ctx();
      } catch {
        return;
      }
      audio.ctx = ctx;
      audio.master = ctx.createGain();
      audio.master.gain.value = 0.9;
      audio.master.connect(ctx.destination);
      // Engine: a sawtooth through a low-pass, pitched by speed.
      audio.engine = ctx.createOscillator();
      audio.engine.type = 'sawtooth';
      audio.engine.frequency.value = 55;
      audio.engineFilter = ctx.createBiquadFilter();
      audio.engineFilter.type = 'lowpass';
      audio.engineFilter.frequency.value = 420;
      audio.engineGain = ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engine.connect(audio.engineFilter);
      audio.engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engine.start();
      // Siren: a square wave that alternates two tones.
      audio.siren = ctx.createOscillator();
      audio.siren.type = 'square';
      audio.siren.frequency.value = 660;
      audio.sirenGain = ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.siren.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.siren.start();
      // Pad: three detuned triangles on a soft chord, breathing slowly.
      const padGain = ctx.createGain();
      padGain.gain.value = 0.035;
      padGain.connect(audio.master);
      for (const freq of [220, 277.18, 329.63]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 8;
        osc.connect(padGain);
        osc.start();
      }
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.015;
      lfo.connect(lfoGain);
      lfoGain.connect(padGain.gain);
      lfo.start();
    },
    setEngine(speed, driving) {
      if (!audio.ctx) return;
      const t = audio.ctx.currentTime;
      audio.engine.frequency.setTargetAtTime(55 + Math.abs(speed) * 4.2, t, 0.08);
      audio.engineGain.gain.setTargetAtTime(driving ? 0.05 + Math.abs(speed) * 0.0016 : 0, t, 0.1);
    },
    setSiren(wanted, now) {
      if (!audio.ctx) return;
      const t = audio.ctx.currentTime;
      if (wanted >= 1) {
        audio.sirenGain.gain.setTargetAtTime(0.022, t, 0.1);
        if (now >= audio.sirenNext) {
          audio.sirenHigh = !audio.sirenHigh;
          audio.siren.frequency.setTargetAtTime(audio.sirenHigh ? 880 : 660, t, 0.03);
          audio.sirenNext = now + 0.45;
        }
      } else {
        audio.sirenGain.gain.setTargetAtTime(0, t, 0.1);
      }
    },
    blip(freq, dur, type = 'sine', vol = 0.25) {
      if (!audio.ctx || audio.muted) return;
      const ctx = audio.ctx;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    },
    thud() { audio.blip(90, 0.16, 'sine', 0.4); },
    jingle() {
      if (!audio.ctx) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        setTimeout(() => audio.blip(f, 0.22, 'triangle', 0.22), i * 110);
      });
    },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.9;
      return audio.muted;
    },
  };
  return audio;
}
