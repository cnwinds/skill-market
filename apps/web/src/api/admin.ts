import { api } from './client';
import type { MarketSubmission, MarketSubmissionListResponse, MarketSubmissionResponse } from '@qizhi/skill-spec';

export type { MarketSubmission, MarketSubmissionListResponse, MarketSubmissionResponse };

export interface AdminReviewsQuery {
  status?: string;
  publisher?: string;
  limit?: number;
  offset?: number;
  [key: string]: string | number | undefined;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const adminApi = {
  listReviews: (query?: AdminReviewsQuery) =>
    api.get<MarketSubmissionListResponse>(`/api/v1/admin/reviews${buildQuery(query ?? {})}`),

  getReview: (id: string) =>
    api.get<MarketSubmissionResponse>(`/api/v1/admin/reviews/${id}`),

  approve: (id: string) =>
    api.post<MarketSubmissionResponse>(`/api/v1/admin/reviews/${id}/approve`),

  reject: (id: string, reason: string) =>
    api.post<MarketSubmissionResponse>(`/api/v1/admin/reviews/${id}/reject`, { reason }),

  removeVersion: (publisher: string, name: string, version: string, reason: string) =>
    api.post<void>(`/api/v1/admin/skills/${publisher}/${name}/versions/${version}/remove`, {
      reason,
    }),

  restoreVersion: (publisher: string, name: string, version: string) =>
    api.post<void>(`/api/v1/admin/skills/${publisher}/${name}/versions/${version}/restore`),

  feature: (publisher: string, name: string) =>
    api.post<void>(`/api/v1/admin/skills/${publisher}/${name}/feature`),

  unfeature: (publisher: string, name: string) =>
    api.post<void>(`/api/v1/admin/skills/${publisher}/${name}/unfeature`),
};
