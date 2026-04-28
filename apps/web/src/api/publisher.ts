import { api } from './client';
import type {
  MarketSubmission,
  MarketSubmissionListResponse,
  MarketSubmissionResponse,
  MarketSkillDetail,
} from '@qizhi/skill-spec';

export type { MarketSubmission, MarketSubmissionListResponse, MarketSubmissionResponse };

export interface PublisherSkillsResponse {
  skills: MarketSkillDetail[];
}

export const publisherApi = {
  uploadSubmission: (file: File, releaseNotes?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (releaseNotes) form.append('releaseNotes', releaseNotes);
    return api.postForm<MarketSubmissionResponse>('/api/v1/publisher/submissions', form);
  },

  listSubmissions: () =>
    api.get<MarketSubmissionListResponse>('/api/v1/publisher/submissions'),

  getSubmission: (id: string) =>
    api.get<MarketSubmissionResponse>(`/api/v1/publisher/submissions/${id}`),

  submitForReview: (id: string, releaseNotes?: string, changeNotes?: string) =>
    api.post<MarketSubmissionResponse>(`/api/v1/publisher/submissions/${id}/submit`, {
      releaseNotes,
      changeNotes,
    }),

  withdraw: (id: string) =>
    api.post<MarketSubmissionResponse>(`/api/v1/publisher/submissions/${id}/withdraw`),

  deleteSubmission: (id: string) =>
    api.delete<void>(`/api/v1/publisher/submissions/${id}`),

  listSkills: () => api.get<PublisherSkillsResponse>('/api/v1/publisher/skills'),

  getSkill: (publisher: string, name: string) =>
    api.get<MarketSkillDetail>(`/api/v1/publisher/skills/${publisher}/${name}`),
};
