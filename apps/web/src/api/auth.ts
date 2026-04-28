import { api, setToken, clearToken } from './client';
import type { MarketAuthUser, MarketAuthResponse, MarketMeResponse } from '@qizhi/skill-spec';

export type { MarketAuthUser, MarketAuthResponse };

export const authApi = {
  me: () => api.get<MarketMeResponse>('/api/v1/auth/me'),

  login: async (email: string, password: string): Promise<MarketAuthUser> => {
    const res = await api.post<MarketAuthResponse>('/api/v1/auth/login', { email, password });
    if (res.token) setToken(res.token);
    return res.user;
  },

  register: async (
    email: string,
    password: string,
    displayName: string,
  ): Promise<MarketAuthUser> => {
    const res = await api.post<MarketAuthResponse>('/api/v1/auth/register', {
      email,
      password,
      displayName,
    });
    if (res.token) setToken(res.token);
    return res.user;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/api/v1/auth/logout');
    } finally {
      clearToken();
    }
  },
};
