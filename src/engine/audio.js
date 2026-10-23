// 環境音はすべて Web Audio API で合成する（外部の音源ファイルを使わない）。
// 位置のある音（電話のベル・草のざわめき等）は HRTF のパンナーで立体化する。
let ctx = null;
let master = null;
let dry = null;
let wet = null;
let convolver = null;
let noiseBuf = null;
let current = null; // 現在の環境音 { stop(), update(listener) }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  dry = ctx.createGain();
  wet = ctx.createGain();
  wet.gain.value = 0;
  convolver = ctx.createConvolver();
  convolver.buffer = impulse(2.6, 2.2);
  dry.connect(master);
  convolver.connect(wet);
  wet.connect(master);
  const len = ctx.sampleRate * 4;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}

export const audioReady = () => !!ctx;

function impulse(sec, decay) {
  const n = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  return b;
}

// 出力先: ドライとリバーブの両方へ
function out(node, send = 1) {
  node.connect(dry);
  if (send > 0) {
    const s = ctx.createGain();
    s.gain.value = send;
    node.connect(s);
    s.connect(convolver);
  }
}

function noise({ type = 'bandpass', freq = 1000, q = 1, gain = 0.1 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  src.loopStart = Math.random();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(f); f.connect(g);
  src.start(0, Math.random() * 3);
  return { src, f, g, out: g };
}

function osc(type, freq, gain) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = gain;
  o.connect(g);
  o.start();
  return { o, g, out: g };
}

function lfo(target, freq, depth, offset = null) {
  const o = ctx.createOscillator();
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.value = depth;
  o.connect(g);
  g.connect(target);
  if (offset !== null) target.value = offset;
  o.start();
  return o;
}

function panner(pos, refDistance = 1.5, rolloff = 1.2) {
  const p = ctx.createPanner();
  p.panningModel = 'HRTF';
  p.distanceModel = 'inverse';
  p.refDistance = refDistance;
  p.rolloffFactor = rolloff;
  p.maxDistance = 200;
  p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2];
  return p;
}

// ---------------------------------------------------------------- 単発の音
function blip(at, { freq = 800, dur = 0.2, type = 'sine', gain = 0.2, to = null, dest = null, attack = 0.005 } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  if (dest) g.connect(dest); else out(g, 0.6);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function burst(at, { freq = 1200, q = 0.8, dur = 0.08, gain = 0.2, type = 'bandpass', dest = null } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f); f.connect(g);
  if (dest) g.connect(dest); else out(g, 0.5);
  src.start(at, Math.random() * 3, dur + 0.05);
}

const STEP = {
  dirt: { freq: 900, q: 0.7, dur: 0.11, gain: 0.08 },
  hard: { freq: 2200, q: 1.2, dur: 0.06, gain: 0.07 },
  carpet: { freq: 500, q: 0.6, dur: 0.09, gain: 0.05 },
  tile: { freq: 2600, q: 1.6, dur: 0.07, gain: 0.08 },
};
export function footstep(kind = 'dirt', running = false) {
  if (!ctx) return;
  const s = STEP[kind] || STEP.dirt;
  const t = ctx.currentTime;
  burst(t, { ...s, freq: s.freq * (0.85 + Math.random() * 0.3), gain: s.gain * (running ? 1.4 : 1) });
  if (kind === 'dirt') burst(t + 0.015, { freq: 3500, q: 0.5, dur: 0.05, gain: 0.02 }); // 落ち葉
}

export function uiTick() {
  if (!ctx) return;
  blip(ctx.currentTime, { freq: 1320, dur: 0.12, gain: 0.05 });
  blip(ctx.currentTime + 0.07, { freq: 1980, dur: 0.18, gain: 0.035 });
}

export function wrongBuzz() {
  if (!ctx) return;
  blip(ctx.currentTime, { freq: 180, dur: 0.35, type: 'triangle', gain: 0.08, to: 120 });
}

// 日本の固定電話風のベル（16Hz で変調した 2 音）。pos があれば立体音響
export function ringPhone({ pos = null, times = 2, gain = 0.18 } = {}) {
  if (!ctx) return () => {};
  const dest = ctx.createGain();
  dest.gain.value = gain;
  let node = dest;
  if (pos) { const p = panner(pos, 1.2, 1.0); dest.connect(p); node = p; }
  out(node, 0.5);
  const t0 = ctx.currentTime + 0.05;
  const stops = [];
  for (let i = 0; i < times; i++) {
    const at = t0 + i * 3.0;
    for (const f of [400, 800]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const am = ctx.createGain();
      am.gain.value = 0;
      const mod = ctx.createOscillator();
      mod.type = 'square';
      mod.frequency.value = 16;
      const mg = ctx.createGain();
      mg.gain.value = 0.5;
      mod.connect(mg); mg.connect(am.gain);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, at);
      env.gain.linearRampToValueAtTime(f === 400 ? 0.5 : 0.18, at + 0.02);
      env.gain.setValueAtTime(f === 400 ? 0.5 : 0.18, at + 1.0);
      env.gain.linearRampToValueAtTime(0, at + 1.05);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2500;
      o.connect(am); am.connect(lp); lp.connect(env); env.connect(dest);
      o.start(at); mod.start(at);
      o.stop(at + 1.1); mod.stop(at + 1.1);
      stops.push(o, mod);
    }
  }
  return () => stops.forEach((o) => { try { o.stop(); } catch { /* 済 */ } });
}

// ---------------------------------------------------------------- 環境音
function fadeIn(g, v, sec = 2.5) {
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(v, ctx.currentTime + sec);
}

function scheduler(fn, min, max) {
  let alive = true;
  let timer;
  const loop = () => {
    if (!alive) return;
    fn();
    timer = setTimeout(loop, (min + Math.random() * (max - min)) * 1000);
  };
  timer = setTimeout(loop, (min + Math.random() * (max - min)) * 500);
  return () => { alive = false; clearTimeout(timer); };
}

const AMBIENCES = {
  // 夏の山里：ミンミンゼミ・アブラゼミ・風・遠くのヒグラシ
  summer_forest(bus, ctxObj) {
    const nodes = [];
    const wind = noise({ type: 'lowpass', freq: 500, q: 0.3, gain: 0.05 });
    lfo(wind.g.gain, 0.07, 0.03, 0.05);
    wind.out.connect(bus); nodes.push(wind.src);
    // アブラゼミ（ジリジリ）
    const abura = noise({ type: 'bandpass', freq: 4300, q: 2.2, gain: 0.02 });
    const am = ctx.createGain(); am.gain.value = 0.6;
    lfo(am.gain, 47, 0.4);
    abura.out.connect(am); am.connect(bus); nodes.push(abura.src);
    // ミンミンゼミ（ミーンミンミン…の周期的なうねり）
    for (const [f, pan, rate] of [[5600, -0.6, 0.55], [6100, 0.7, 0.48]]) {
      const n = noise({ type: 'bandpass', freq: f, q: 6, gain: 0.0 });
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      const env = ctx.createGain(); env.gain.value = 0;
      n.out.connect(env); env.connect(p); p.connect(bus);
      n.g.gain.value = 0.05;
      nodes.push(n.src);
      const stop = scheduler(() => {
        const t = ctx.currentTime;
        const reps = 6 + Math.floor(Math.random() * 6);
        for (let i = 0; i < reps; i++) {
          const at = t + i / (rate * 2);
          env.gain.setValueAtTime(0.0001, at);
          env.gain.exponentialRampToValueAtTime(i === 0 ? 0.6 : 0.4, at + 0.05);
          env.gain.exponentialRampToValueAtTime(0.0001, at + 0.75 / (rate * 2) + (i === 0 ? 0.5 : 0));
        }
      }, 4, 9);
      ctxObj.stoppers.push(stop);
    }
    // 遠くのヒグラシ（カナカナ…）
    ctxObj.stoppers.push(scheduler(() => {
      const t = ctx.currentTime;
      for (let i = 0; i < 14; i++) blip(t + i * 0.11, { freq: 4200 - i * 30, dur: 0.09, gain: 0.006, type: 'triangle' });
    }, 9, 20));
    // 草のざわめき（痕跡「草むら」）
    if (ctxObj.sounds.rustle) {
      const p = panner(ctxObj.sounds.rustle, 1.0, 1.4);
      const r = noise({ type: 'highpass', freq: 2500, q: 0.4, gain: 0.0 });
      lfo(r.g.gain, 0.6, 0.04, 0.04);
      r.out.connect(p); p.connect(bus); nodes.push(r.src);
    }
    return nodes;
  },

  // 深夜の電車〜無人駅
  night_train(bus, ctxObj) {
    const nodes = [];
    const rumble = noise({ type: 'lowpass', freq: 110, q: 0.7, gain: 0.14 });
    const rg = ctx.createGain(); rg.gain.value = 1;
    rumble.out.connect(rg); rg.connect(bus); nodes.push(rumble.src);
    ctxObj.trainGain = rg;
    // 停車中の電車：ときどきコンプレッサーが息をつく
    ctxObj.stoppers.push(scheduler(() => {
      if (ctxObj.zone > 1) return;
      burst(ctx.currentTime, { freq: 2500, q: 0.4, dur: 1.4, gain: 0.04, type: 'highpass', dest: bus });
    }, 9, 16));
    const hum = osc('sawtooth', 100, 0.004);
    hum.out.connect(bus); nodes.push(hum.o);
    // 遠くの太鼓と鈴（第2区画から）
    const far = panner(ctxObj.sounds.taiko || [0, 2, -80], 6, 0.8);
    far.connect(bus);
    ctxObj.stoppers.push(scheduler(() => {
      if (ctxObj.zone < 2) return;
      const t = ctx.currentTime;
      const pattern = [0, 0.55, 1.1, 1.4, 1.65];
      for (const d of pattern) {
        blip(t + d, { freq: 75, to: 48, dur: 0.6, gain: 0.5, dest: far });
        burst(t + d, { freq: 200, q: 0.8, dur: 0.15, gain: 0.25, dest: far });
      }
      for (let i = 0; i < 6; i++) {
        const at = t + 2.2 + i * 0.16 + Math.random() * 0.05;
        blip(at, { freq: 2650, dur: 0.6, gain: 0.025, dest: far });
        blip(at, { freq: 3980, dur: 0.4, gain: 0.015, dest: far });
      }
    }, 7, 12));
    return nodes;
  },

  netcafe(bus) {
    const nodes = [];
    const fan = noise({ type: 'lowpass', freq: 700, q: 0.4, gain: 0.06 });
    fan.out.connect(bus); nodes.push(fan.src);
    const hum = osc('sine', 120, 0.01); hum.out.connect(bus); nodes.push(hum.o);
    const hiss = noise({ type: 'highpass', freq: 9000, q: 0.3, gain: 0.006 });
    hiss.out.connect(bus); nodes.push(hiss.src);
    return nodes;
  },

  airport(bus, ctxObj) {
    const nodes = [];
    const hvac = noise({ type: 'lowpass', freq: 260, q: 0.5, gain: 0.12 });
    hvac.out.connect(bus); nodes.push(hvac.src);
    const wind = noise({ type: 'bandpass', freq: 380, q: 0.6, gain: 0.03 });
    lfo(wind.g.gain, 0.05, 0.02, 0.03);
    wind.out.connect(bus); nodes.push(wind.src);
    // 誰もいないのに鳴る館内チャイム
    ctxObj.stoppers.push(scheduler(() => {
      const t = ctx.currentTime;
      [659, 523, 587, 392].forEach((f, i) => blip(t + i * 0.55, { freq: f, dur: 1.4, gain: 0.04, dest: bus, attack: 0.02 }));
    }, 25, 45));
    return nodes;
  },

  night_town(bus) {
    const nodes = [];
    const traffic = noise({ type: 'lowpass', freq: 220, q: 0.4, gain: 0.05 });
    lfo(traffic.g.gain, 0.03, 0.02, 0.05);
    traffic.out.connect(bus); nodes.push(traffic.src);
    // コオロギ
    // コオロギ: 4.7kHz を 28Hz で刻み、さらに 0.7Hz で鳴いたり止んだりさせる
    const cricket = osc('sine', 4700, 0.012);
    const chirp = ctx.createGain();
    const phrase = ctx.createGain();
    cricket.out.connect(chirp); chirp.connect(phrase); phrase.connect(bus);
    lfo(chirp.gain, 28, 0.5, 0.5);
    lfo(phrase.gain, 0.7, 0.5, 0.5);
    nodes.push(cricket.o);
    const hum = osc('sawtooth', 100, 0.003); hum.out.connect(bus); nodes.push(hum.o);
    return nodes;
  },

  pool(bus) {
    const nodes = [];
    const water = noise({ type: 'bandpass', freq: 600, q: 0.8, gain: 0.03 });
    lfo(water.f.frequency, 0.3, 150, 600);
    water.out.connect(bus); nodes.push(water.src);
    const hum = osc('sawtooth', 100, 0.004); hum.out.connect(bus); nodes.push(hum.o);
    const air = noise({ type: 'lowpass', freq: 300, q: 0.3, gain: 0.05 }); air.out.connect(bus); nodes.push(air.src);
    return nodes;
  },
};

export function startAmbience(name, { reverb = 0.2, sounds = {} } = {}) {
  if (!ctx) return null;
  stopAmbience();
  wet.gain.setTargetAtTime(reverb, ctx.currentTime, 0.5);
  const bus = ctx.createGain();
  out(bus, 0.3);
  fadeIn(bus, 1, 3);
  const obj = { stoppers: [], sounds, zone: 1, bus, trainGain: null };
  const nodes = (AMBIENCES[name] || (() => []))(bus, obj);
  current = {
    obj,
    stop(sec = 1.2) {
      obj.stoppers.forEach((s) => s());
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + sec);
      setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch { /* 済 */ } }); bus.disconnect(); }, sec * 1000 + 100);
    },
  };
  return current;
}

export function setAmbienceZone(z) {
  if (!current) return;
  current.obj.zone = z;
  // 電車を降りたら走行音を消す
  if (current.obj.trainGain && z >= 2) current.obj.trainGain.gain.setTargetAtTime(0.05, ctx.currentTime, 1.5);
}

export function stopAmbience(sec) {
  if (current) { current.stop(sec); current = null; }
}

export function setListener(camera) {
  if (!ctx) return;
  const l = ctx.listener;
  const p = camera.position;
  const t = ctx.currentTime;
  const fwd = { x: -Math.sin(camera.rotation.y), z: -Math.cos(camera.rotation.y) };
  if (l.positionX) {
    l.positionX.setTargetAtTime(p.x, t, 0.02);
    l.positionY.setTargetAtTime(p.y, t, 0.02);
    l.positionZ.setTargetAtTime(p.z, t, 0.02);
    l.forwardX.setTargetAtTime(fwd.x, t, 0.02);
    l.forwardY.setTargetAtTime(0, t, 0.02);
    l.forwardZ.setTargetAtTime(fwd.z, t, 0.02);
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else {
    l.setPosition(p.x, p.y, p.z);
    l.setOrientation(fwd.x, 0, fwd.z, 0, 1, 0);
  }
}

export function setMasterMute(m) {
  if (!ctx) return;
  master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.4);
}
