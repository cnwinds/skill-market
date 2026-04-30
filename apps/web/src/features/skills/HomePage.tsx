import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { skillsApi } from '../../api/skills';
import SkillCard from '../../components/SkillCard';
import SearchBar from '../../components/SearchBar';
import { SkeletonList } from '../../components/SkeletonCard';

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
      <section className="pt-8 pb-6 text-center sm:pt-10 sm:pb-7">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold leading-tight text-gray-950 sm:text-5xl lg:text-6xl dark:text-gray-50">
            发现和分发 SkillChat 技能
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-gray-500 sm:text-lg dark:text-gray-400">
            安全审核、版本管理、一键下载。扩展你的 AI 助手能力。
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-3xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <SearchBar placeholder="搜索 Skill…" />
            </div>

            <Link
              to="/publish"
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-blue-600 dark:hover:text-blue-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              提交 Skill
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {topCategories.map((c) => (
              <button
                key={c.name}
                onClick={() => navigate(`/skills?category=${encodeURIComponent(c.name)}`)}
                className="flex items-center gap-1.5 rounded-full border border-transparent bg-gray-100/80 px-2.5 py-1 text-xs text-gray-500 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:bg-gray-900 dark:text-gray-500 dark:hover:border-blue-700 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
                <span>{c.name}</span>
                <span className="text-gray-400 dark:text-gray-600">{c.count}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Security notice */}
      <section className="mx-auto mb-7 flex max-w-5xl items-start gap-2.5 rounded-lg border border-blue-200/70 bg-blue-50/70 px-3 py-2.5 dark:border-blue-900/70 dark:bg-blue-950/30">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <div className="text-xs leading-5 text-blue-800 sm:text-sm dark:text-blue-200">
          <strong>安全保障：</strong>
          所有 Skill 须通过人工审核方可上架；权限声明完全透明可查；包文件提供 SHA256 校验。
        </div>
      </section>

      {/* Featured */}
      {(featuredLoading || featured.length > 0) && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">精选 Skill</h2>
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
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">最新发布</h2>
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
