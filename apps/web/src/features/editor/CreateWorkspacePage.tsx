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
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <h1 className="text-lg font-semibold text-red-700 mb-2">无法创建编辑工作区</h1>
          <p className="text-sm text-red-600 mb-4">
            {mutation.error instanceof Error ? mutation.error.message : '请稍后重试'}
          </p>
          <Link to={`/skills/${publisher}/${name}`} className="text-sm text-blue-600 hover:underline">
            返回 Skill 详情
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">正在创建编辑工作区</h1>
        <p className="text-sm text-gray-500">系统正在从最新公开版本解包并准备在线编辑环境。</p>
      </div>
    </div>
  );
}
