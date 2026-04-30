import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { editorApi } from '../../api/editor';

export default function CreateWorkspacePage() {
  const { publisher, name } = useParams<{ publisher: string; name: string }>();
  const navigate = useNavigate();
  const startedRef = useRef(false);

  const mutation = useMutation({
    mutationFn: () => editorApi.createWorkspace(publisher!, name!),
    onSuccess: (res) => navigate(`/publisher/edit-workspaces/${res.workspace.id}`, { replace: true }),
  });

  useEffect(() => {
    if (!publisher || !name || startedRef.current) return;
    startedRef.current = true;
    mutation.mutate();
  }, [publisher, name, mutation]);

  if (mutation.isError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-2">无法创建编辑工作区</h1>
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {mutation.error instanceof Error ? mutation.error.message : '请稍后重试'}
          </p>
          <Link to={`/skills/${publisher}/${name}`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            返回 Skill 详情
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">正在创建编辑工作区</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">系统正在从最新公开版本解包并准备在线编辑环境。</p>
      </div>
    </div>
  );
}
