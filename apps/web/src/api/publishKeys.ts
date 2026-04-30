import { api } from './client';
import type { MarketPublishKey, MarketPublishKeyListResponse, MarketPublishKeyResponse } from '@qizhi/skill-spec';

export type { MarketPublishKey };

export const publishKeysApi = {
  list: (publisher?: string) => {
    const qs = publisher ? `?publisher=${encodeURIComponent(publisher)}` : '';
    return api.get<MarketPublishKeyListResponse>(`/api/v1/publisher/publish-keys${qs}`);
  },

  create: (name: string, publisher: string, expiresAt?: string) =>
    api.post<MarketPublishKeyResponse>('/api/v1/publisher/publish-keys', {
      name,
      publisher,
      expiresAt,
    }),

  revoke: (id: string) =>
    api.post<MarketPublishKeyResponse>(`/api/v1/publisher/publish-keys/${id}/revoke`),
};
