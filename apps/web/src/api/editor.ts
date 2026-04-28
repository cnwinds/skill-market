import { api } from './client';
import type {
  MarketDeveloperKeyListResponse,
  MarketDeveloperKeyResponse,
  MarketDevReleaseListResponse,
  MarketDevReleaseResponse,
  MarketEditWorkspaceResponse,
  MarketPackageFileEntry,
  MarketPackageValidation,
  MarketWorkspaceFileContentResponse,
  MarketWorkspaceFileListResponse,
  SkillManifest,
} from '@qizhi/skill-spec';

export interface ValidateWorkspaceResponse {
  workspace: MarketEditWorkspaceResponse['workspace'];
  validation: MarketPackageValidation;
  manifest?: SkillManifest;
  fileEntries: MarketPackageFileEntry[];
}

export const editorApi = {
  createWorkspace: (publisher: string, name: string, sourceVersion?: string) =>
    api.post<MarketEditWorkspaceResponse>(`/api/v1/publisher/skills/${publisher}/${name}/edit-workspaces`, {
      sourceVersion,
    }),

  getWorkspace: (workspaceId: string) =>
    api.get<MarketEditWorkspaceResponse>(`/api/v1/publisher/edit-workspaces/${workspaceId}`),

  patchWorkspace: (workspaceId: string, targetVersion: string, baseRevision: number) =>
    api.patch<MarketEditWorkspaceResponse>(`/api/v1/publisher/edit-workspaces/${workspaceId}`, {
      targetVersion,
      baseRevision,
    }),

  listFiles: (workspaceId: string, path = '') =>
    api.get<MarketWorkspaceFileListResponse>(
      `/api/v1/publisher/edit-workspaces/${workspaceId}/files?path=${encodeURIComponent(path)}`,
    ),

  readFile: (workspaceId: string, path: string) =>
    api.get<MarketWorkspaceFileContentResponse>(
      `/api/v1/publisher/edit-workspaces/${workspaceId}/files/content?path=${encodeURIComponent(path)}`,
    ),

  writeFile: (workspaceId: string, path: string, content: string, baseRevision: number) =>
    api.put<MarketEditWorkspaceResponse>(`/api/v1/publisher/edit-workspaces/${workspaceId}/files/content`, {
      path,
      content,
      baseRevision,
    }),

  createFile: (
    workspaceId: string,
    path: string,
    kind: 'file' | 'directory',
    baseRevision: number,
    content = '',
  ) =>
    api.post<MarketEditWorkspaceResponse>(`/api/v1/publisher/edit-workspaces/${workspaceId}/files`, {
      path,
      kind,
      content,
      baseRevision,
    }),

  deleteFile: (workspaceId: string, path: string, baseRevision: number) =>
    api.delete<MarketEditWorkspaceResponse>(
      `/api/v1/publisher/edit-workspaces/${workspaceId}/files?path=${encodeURIComponent(path)}&baseRevision=${baseRevision}`,
    ),

  validate: (workspaceId: string) =>
    api.post<ValidateWorkspaceResponse>(`/api/v1/publisher/edit-workspaces/${workspaceId}/validate`),

  submit: (workspaceId: string, releaseNotes?: string, changeNotes?: string) =>
    api.post(`/api/v1/publisher/edit-workspaces/${workspaceId}/submit`, {
      releaseNotes,
      changeNotes,
    }),

  listDevReleases: (workspaceId: string) =>
    api.get<MarketDevReleaseListResponse>(`/api/v1/publisher/edit-workspaces/${workspaceId}/dev-releases`),

  createDevRelease: (workspaceId: string, version?: string) =>
    api.post<MarketDevReleaseResponse>(`/api/v1/publisher/edit-workspaces/${workspaceId}/dev-releases`, {
      version,
    }),

  createDeveloperKey: (name: string, skillId: string) =>
    api.post<MarketDeveloperKeyResponse>('/api/v1/publisher/dev-keys', {
      name,
      skillId,
    }),

  listDeveloperKeys: (skillId: string) =>
    api.get<MarketDeveloperKeyListResponse>(`/api/v1/publisher/dev-keys?skillId=${encodeURIComponent(skillId)}`),

  revokeDeveloperKey: (keyId: string) =>
    api.post<MarketDeveloperKeyResponse>(`/api/v1/publisher/dev-keys/${keyId}/revoke`),
};
