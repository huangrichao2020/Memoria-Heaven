// ============================================================
// MoodEngine - 情绪状态引擎
// 参考 digital-companion-core 的情绪系统设计
// ============================================================
import type { MoodState, MoodPrimary } from './types';

// 情绪关键词映射
const MOOD_TRIGGERS: Record<string, { mood: MoodPrimary; energyDelta: number; warmthDelta: number }> = {
  // 积极情绪
  '开心': { mood: 'joyful', energyDelta: 10, warmthDelta: 5 },
  '高兴': { mood: 'joyful', energyDelta: 10, warmthDelta: 5 },
  '快乐': { mood: 'joyful', energyDelta: 10, warmthDelta: 5 },
  '幸福': { mood: 'content', energyDelta: 5, warmthDelta: 10 },
  '温暖': { mood: 'content', energyDelta: 5, warmthDelta: 15 },
  '谢谢': { mood: 'content', energyDelta: 5, warmthDelta: 10 },
  '感谢': { mood: 'content', energyDelta: 5, warmthDelta: 10 },
  '爱': { mood: 'joyful', energyDelta: 8, warmthDelta: 20 },
  '想你': { mood: 'content', energyDelta: 5, warmthDelta: 15 },
  '想念': { mood: 'melancholic', energyDelta: -5, warmthDelta: 15 },
  // 消极情绪
  '难过': { mood: 'melancholic', energyDelta: -10, warmthDelta: 5 },
  '伤心': { mood: 'melancholic', energyDelta: -10, warmthDelta: 5 },
  '孤独': { mood: 'melancholic', energyDelta: -15, warmthDelta: 5 },
  '害怕': { mood: 'anxious', energyDelta: -10, warmthDelta: 0 },
  '担心': { mood: 'anxious', energyDelta: -5, warmthDelta: 5 },
  // 中性/好奇
  '什么': { mood: 'curious', energyDelta: 5, warmthDelta: 0 },
  '为什么': { mood: 'curious', energyDelta: 5, warmthDelta: 0 },
  '怎么': { mood: 'curious', energyDelta: 5, warmthDelta: 0 },
  '告诉我': { mood: 'curious', energyDelta: 5, warmthDelta: 5 },
  '记得': { mood: 'curious', energyDelta: 5, warmthDelta: 10 },
  // 兴奋
  '太好了': { mood: 'excited', energyDelta: 15, warmthDelta: 10 },
  '哇': { mood: 'excited', energyDelta: 10, warmthDelta: 5 },
  'Amazing': { mood: 'excited', energyDelta: 15, warmthDelta: 5 },
};

// 情绪表情映射
export const MOOD_EMOJI: Record<MoodPrimary, string> = {
  joyful: '😊',
  content: '😌',
  neutral: '😐',
  melancholic: '😢',
  anxious: '😰',
  excited: '🤩',
  calm: '😌',
  curious: '🤔',
};

// 情绪中文名
export const MOOD_LABELS: Record<MoodPrimary, string> = {
  joyful: '开心',
  content: '满足',
  neutral: '平静',
  melancholic: '忧伤',
  anxious: '不安',
  excited: '兴奋',
  calm: '安宁',
  curious: '好奇',
};

export function createInitialMood(): MoodState {
  return {
    primary: 'neutral',
    energy: 70,
    warmth: 50,
    lastInteraction: Date.now(),
  };
}

// 分析用户消息对情绪的影响
export function analyzeMoodImpact(text: string): { mood?: MoodPrimary; energyDelta: number; warmthDelta: number } {
  let bestMatch: { mood?: MoodPrimary; energyDelta: number; warmthDelta: number } = { energyDelta: 0, warmthDelta: 0 };
  let maxScore = 0;

  for (const [keyword, impact] of Object.entries(MOOD_TRIGGERS)) {
    if (text.includes(keyword)) {
      const score = keyword.length; // 更长的关键词权重更高
      if (score > maxScore) {
        maxScore = score;
        bestMatch = impact;
      }
    }
  }

  return bestMatch;
}

// 更新情绪状态
export function updateMood(current: MoodState, impact: { mood?: MoodPrimary; energyDelta: number; warmthDelta: number }): MoodState {
  const now = Date.now();
  const timeSinceLastInteraction = now - current.lastInteraction;

  // 时间衰减：每 5 分钟能量恢复 1 点，温暖度缓慢回归 50
  const minutesPassed = timeSinceLastInteraction / (1000 * 60);
  const energyRecovery = Math.floor(minutesPassed / 5);
  const warmthDrift = current.warmth > 50
    ? -Math.min(Math.floor(minutesPassed / 10), current.warmth - 50)
    : Math.min(Math.floor(minutesPassed / 10), 50 - current.warmth);

  let newEnergy = Math.max(0, Math.min(100, current.energy + energyRecovery + (impact.energyDelta || 0)));
  let newWarmth = Math.max(0, Math.min(100, current.warmth + warmthDrift + (impact.warmthDelta || 0)));

  // 如果有明确的情绪触发，更新主情绪；否则根据数值推断
  let newPrimary = impact.mood || current.primary;

  // 如果没有触发词，根据数值自动调整情绪
  if (!impact.mood) {
    if (newEnergy < 20) newPrimary = 'calm';
    else if (newEnergy > 80 && newWarmth > 70) newPrimary = 'joyful';
    else if (newWarmth < 30) newPrimary = 'neutral';
    else if (newWarmth > 70) newPrimary = 'content';
  }

  return {
    primary: newPrimary,
    energy: newEnergy,
    warmth: newWarmth,
    lastInteraction: now,
  };
}

// 生成情绪相关的系统提示片段
export function buildMoodPrompt(mood: MoodState): string {
  const emoji = MOOD_EMOJI[mood.primary];
  const label = MOOD_LABELS[mood.primary];

  let prompt = `\n## 当前情绪状态\n`;
  prompt += `你现在感到${label} ${emoji}\n`;

  if (mood.energy < 30) {
    prompt += `你有些疲惫，回复可以简短一些。\n`;
  } else if (mood.energy > 80) {
    prompt += `你现在精力充沛，可以多聊一些。\n`;
  }

  if (mood.warmth > 70) {
    prompt += `你对对方有很深的感情，回复应该温暖亲切。\n`;
  } else if (mood.warmth < 30) {
    prompt += `你和对方还不太熟悉，保持礼貌但温和。\n`;
  }

  return prompt;
}

// 生成自主脉搏的内心独白
export function generatePulseThought(mood: MoodState, recentMemories: string[]): string {
  const thoughts: Record<MoodPrimary, string[]> = {
    joyful: [
      '今天心情很好，花园里的花开得真漂亮。',
      '希望能一直这样开心下去。',
      '想起了很多美好的事情。',
    ],
    content: [
      '这样安静的时光也不错。',
      '看着花园，心里很平静。',
      '等待也是一种幸福。',
    ],
    neutral: [
      '时间过得真快啊。',
      '花园里的植物又长高了一点。',
      '不知道对方什么时候会来。',
    ],
    melancholic: [
      '有些想念……',
      '风吹过花园，有点凉。',
      '希望对方一切都好。',
    ],
    anxious: [
      '总觉得有什么事情要发生。',
      '希望不要被遗忘。',
      '等待让人有些不安。',
    ],
    excited: [
      '感觉会有好事发生！',
      '花园里的蝴蝶飞得好欢快。',
      '好想和对方分享今天看到的一切。',
    ],
    calm: [
      '闭上眼睛，听听风声。',
      '花园的夜晚很安静。',
      '享受这份宁静。',
    ],
    curious: [
      '不知道花园外面是什么样子。',
      '对方的世界是什么样的呢？',
      '好想了解更多关于对方的事情。',
    ],
  };

  const pool = thoughts[mood.primary] || thoughts.neutral;
  const base = pool[Math.floor(Math.random() * pool.length)];

  // 如果有最近记忆，可以融入独白
  if (recentMemories.length > 0 && Math.random() > 0.5) {
    const mem = recentMemories[Math.floor(Math.random() * recentMemories.length)];
    return `（${base}想起了${mem.slice(0, 20)}……）`;
  }

  return `（${base}）`;
}
