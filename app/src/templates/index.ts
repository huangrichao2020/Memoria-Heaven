// ============================================================
// Template Registry - 模板注册表
// ============================================================
import type { MapTemplate } from '../lib/types';
import { createGardenTemplate } from './garden';
import { createStarfieldTemplate } from './starfield';
import { createZenTemplate } from './zen';
import { createLibraryTemplate } from './library';

export const TEMPLATES: MapTemplate[] = [
  {
    id: 'garden',
    name: '记忆花园',
    description: '温暖的花园，有纪念碑、花环、树木和许愿池',
    icon: '🌸',
    create: createGardenTemplate,
  },
  {
    id: 'starfield',
    name: '星空纪念堂',
    description: '深邃的星空下，水晶柱与星座环绕的纪念空间',
    icon: '✨',
    create: createStarfieldTemplate,
  },
  {
    id: 'zen',
    name: '禅意花园',
    description: '日式枯山水，沙石、竹林、锦鲤池的宁静之地',
    icon: '🪨',
    create: createZenTemplate,
  },
  {
    id: 'library',
    name: '记忆图书馆',
    description: '古老图书馆，书架环绕，烛光摇曳的阅读空间',
    icon: '📚',
    create: createLibraryTemplate,
  },
];

export function getTemplate(id: string): MapTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function createFromTemplate(templateId: string, name: string) {
  const template = getTemplate(templateId);
  if (!template) {
    // 默认使用花园模板
    return createGardenTemplate(name);
  }
  return template.create(name);
}
