import { api } from './client';
import type {
  MarketSkillListResponse,
  MarketSkillDetail,
  MarketSkillVersionsResponse,
  SkillManifest,
} from '@qizhi/skill-spec';

export interface SkillsQuery {
  query?: string;
  kind?: string;
  category?: string;
  tag?: string;
  publisher?: string;
  sort?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
}

export type { MarketSkillListResponse, MarketSkillDetail, MarketSkillVersionsResponse };

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const skillsApi = {
  list: (query?: SkillsQuery) =>
    api.get<MarketSkillListResponse>(`/api/v1/skills${buildQuery(query ?? {})}`),

  detail: (publisher: string, name: string) =>
    api.get<MarketSkillDetail>(`/api/v1/skills/${publisher}/${name}`),

  versions: (publisher: string, name: string) =>
    api.get<MarketSkillVersionsResponse>(`/api/v1/skills/${publisher}/${name}/versions`),

  manifest: (publisher: string, name: string, version: string) =>
    api.get<SkillManifest>(`/api/v1/skills/${publisher}/${name}/versions/${version}/manifest`),

  packageUrl: (publisher: string, name: string, version: string) =>
    `/api/v1/skills/${publisher}/${name}/versions/${version}/package`,

  categories: () =>
    api.get<{ categories: { name: string; count: number }[] }>('/api/v1/categories'),

  tags: () =>
    api.get<{ tags: { name: string; count: number }[] }>('/api/v1/tags'),

  featured: () =>
    api.get<MarketSkillListResponse>('/api/v1/featured-skills'),
};
