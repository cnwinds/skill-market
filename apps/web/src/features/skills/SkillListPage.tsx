import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { skillsApi } from '../../api/skills';
import SkillCard from '../../components/SkillCard';
import SearchBar from '../../components/SearchBar';
import { SkeletonList } from '../../components/SkeletonCard';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import type { SkillKind } from '@qizhi/skill-spec';

const KIND_OPTIONS: { value: SkillKind | ''; label: string }[] = [
  { value: '', label: '全部类型' },
  { value: 'instruction', label: '指令' },
  { value: 'runtime', label: '运行时' },
  { value: 'hybrid', label: '混合' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: '最新' },
  { value: 'name', label: '名称' },
];

export default function SkillListPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('query') ?? '';
  const kind = searchParams.get('kind') ?? '';
  const category = searchParams.get('category') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const sort = searchParams.get('sort') ?? 'newest';

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['skills', query, kind, category, tag, sort],
    queryFn: () =>
      skillsApi.list({
        query: query || undefined,
        kind: kind || undefined,
        category: category || undefined,
        tag: tag || undefined,
        sort: sort || undefined,
      }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: skillsApi.categories,
  });

  const skills = data?.skills ?? [];
  const categories = categoriesData?.categories ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">首页</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-sm text-gray-900 dark:text-gray-100">探索</span>
      </div>

      <div className="mb-6">
        <SearchBar onSearch={(q) => setParam('query', q)} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar filters */}
        <aside className="lg:w-52 shrink-0 space-y-5">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">类型</h3>
            <div className="space-y-1">
              {KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setParam('kind', opt.value)}
                  className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                    kind === opt.value
                      ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {categories.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">分类</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setParam('category', '')}
                  className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                    !category ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                  }`}
                >
                  全部
                </button>
                {categories.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => setParam('category', c.name)}
                    className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors flex justify-between items-center ${
                      category === c.name
                        ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{c.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isLoading ? '加载中…' : `共 ${skills.length} 个 Skill`}
              {query && <span>，关键词："{query}"</span>}
              {category && <span>，分类：{category}</span>}
            </p>
            <select
              value={sort}
              onChange={(e) => setParam('sort', e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {isLoading && <SkeletonList count={9} />}

          {isError && (
            <ErrorState
              message="获取 Skill 列表失败"
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && skills.length === 0 && (
            <EmptyState
              title="未找到匹配的 Skill"
              message="尝试调整关键词或筛选条件"
              action={
                <button
                  onClick={() => setSearchParams({})}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  清除所有筛选
                </button>
              }
            />
          )}

          {!isLoading && !isError && skills.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {skills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
