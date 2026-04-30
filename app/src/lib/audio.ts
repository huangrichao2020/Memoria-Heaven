// ============================================================
// Audio System - 程序化音效
// 使用 Web Audio API 生成，无需外部音频文件
// ============================================================

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.3;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function getMasterGain(): GainNode {
  getAudioContext();
  return masterGain!;
}

// 白噪声生成器
function createWhiteNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

// 环境风声
export function playWindSound(duration: number = 5): void {
  const ctx = getAudioContext();
  const noise = createWhiteNoise(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 1;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.5);
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + duration - 0.5);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterGain());
  noise.start();
  noise.stop(ctx.currentTime + duration);
}

// 鸟鸣声
export function playBirdChirp(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  osc.type = 'sine';

  const now = ctx.currentTime;
  // 模拟鸟鸣的频率变化
  osc.frequency.setValueAtTime(2000, now);
  osc.frequency.linearRampToValueAtTime(3000, now + 0.05);
  osc.frequency.linearRampToValueAtTime(2500, now + 0.1);
  osc.frequency.linearRampToValueAtTime(3500, now + 0.15);
  osc.frequency.linearRampToValueAtTime(2000, now + 0.2);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
  gain.gain.linearRampToValueAtTime(0.1, now + 0.1);
  gain.gain.linearRampToValueAtTime(0, now + 0.25);

  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.3);
}

// 蜡烛点燃声
export function playCandleLight(): void {
  const ctx = getAudioContext();
  const noise = createWhiteNoise(ctx, 0.3);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 6000;
  filter.Q.value = 2;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterGain());
  noise.start(now);
  noise.stop(now + 0.3);
}

// 水滴声（许愿池）
export function playWaterDrop(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  osc.type = 'sine';

  const now = ctx.currentTime;
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.3);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 0.4);
}

// 天灯升空声
export function playLanternRise(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  osc.type = 'sine';

  const now = ctx.currentTime;
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(600, now + 1.5);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
  gain.gain.linearRampToValueAtTime(0.1, now + 1);
  gain.gain.linearRampToValueAtTime(0, now + 1.5);

  // 添加轻微的颤音
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 20;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  lfo.start(now);
  lfo.stop(now + 1.5);

  osc.connect(gain);
  gain.connect(getMasterGain());
  osc.start(now);
  osc.stop(now + 1.5);
}

// 蝴蝶翅膀声
export function playButterflyFlutter(): void {
  const ctx = getAudioContext();
  const noise = createWhiteNoise(ctx, 0.5);

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3000;
  filter.Q.value = 5;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
  gain.gain.setValueAtTime(0.05, now + 0.1);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.15);
  gain.gain.setValueAtTime(0.05, now + 0.2);
  gain.gain.linearRampToValueAtTime(0, now + 0.5);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterGain());
  noise.start(now);
  noise.stop(now + 0.5);
}

// 翻书声
export function playPageTurn(): void {
  const ctx = getAudioContext();
  const noise = createWhiteNoise(ctx, 0.2);

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 2000;

  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(getMasterGain());
  noise.start(now);
  noise.stop(now + 0.2);
}

// 水晶共鸣声
export function playCrystalResonance(): void {
  const ctx = getAudioContext();
  const frequencies = [523, 659, 784]; // C5, E5, G5 和弦

  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const offset = i * 0.1;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.1, now + offset + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 2);

    osc.connect(gain);
    gain.connect(getMasterGain());
    osc.start(now + offset);
    osc.stop(now + offset + 2);
  });
}

// 设置主音量
export function setMasterVolume(volume: number): void {
  getMasterGain().gain.value = Math.max(0, Math.min(1, volume));
}

// 恢复音频上下文（处理浏览器自动播放限制）
export function resumeAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}
