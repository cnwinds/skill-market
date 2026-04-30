import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { skillsApi } from '../../api/skills';
import SkillCard from '../../components/SkillCard';
import SearchBar from '../../components/SearchBar';
import { SkeletonList } from '../../components/SkeletonCard';

const CATEGORY_ICONS: Record<string, string> = {
  productivity: '📋',
  documents: '📄',
  development: '💻',
  research: '🔬',
  data: '📊',
  automation: '⚙️',
  multimedia: '🎬',
  communication: '💬',
};

export default function HomePage() {
  const navigate = useNavigate();

  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ['featured-skills'],
    queryFn: skillsApi.featured,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: skillsApi.categories,
  });

  const { data: latestData, isLoading: latestLoading } = useQuery({
    queryKey: ['skills', 'latest'],
    queryFn: () => skillsApi.list({ sort: 'newest', limit: 8 }),
  });

  const topCategories = categoriesData?.categories.slice(0, 8) ?? [];
  const featured = featuredData?.skills ?? [];
  const latest = latestData?.skills ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="py-16 sm:py-20 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-50 mb-3">
          发现和分发 SkillChat 技能
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg mb-8 max-w-xl mx-auto">
          安全审核、版本管理、一键下载。扩展你的 AI 助手能力。
        </p>

        <div className="max-w-xl mx-auto mb-6">
          <SearchBar placeholder="搜索 Skill…" autoFocus />
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {topCategories.map((c) => (
            <button
              key={c.name}
              onClick={() => navigate(`/skills?category=${encodeURIComponent(c.name)}`)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-gray-700 dark:text-gray-300"
            >
              <span>{CATEGORY_ICONS[c.name] ?? '📦'}</span>
              <span>{c.name}</span>
              <span className="text-gray-400 dark:text-gray-500 text-xs">({c.count})</span>
            </button>
          ))}
        </div>

        <Link
          to="/publish"
          className="inline-flex items-center gap-2 text-sm bg-white dark:bg-gray-800 border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          提交我的 Skill
        </Link>
      </section>

      {/* Security notice */}
      <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-10 flex items-start gap-3">
        <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <div className="text-sm text-blue-800 dark:text-blue-200">
          <strong>安全保障：</strong>
          所有 Skill 须通过人工审核方可上架；权限声明完全透明可查；包文件提供 SHA256 校验。
        </div>
      </section>

      {/* Featured */}
      {(featuredLoading || featured.length > 0) && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">精选 Skill</h2>
            <Link to="/skills?featured=true" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              查看全部 &rarr;
            </Link>
          </div>
          {featuredLoading ? (
            <SkeletonList count={4} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featured.slice(0, 8).map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Latest */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">最新发布</h2>
          <Link to="/skills" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
            浏览全部 &rarr;
          </Link>
        </div>
        {latestLoading ? (
          <SkeletonList count={6} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {latest.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
