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
      <section className="py-16 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          发现和分发 SkillChat 技能
        </h1>
        <p className="text-gray-500 text-lg mb-8 max-w-xl mx-auto">
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
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <span>{CATEGORY_ICONS[c.name] ?? '📦'}</span>
              <span>{c.name}</span>
              <span className="text-gray-400 text-xs">({c.count})</span>
            </button>
          ))}
        </div>

        <Link
          to="/publish"
          className="inline-flex items-center gap-2 text-sm bg-white border border-blue-600 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          ⬆️ 提交我的 Skill
        </Link>
      </section>

      {/* Security notice */}
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-10 flex items-start gap-3">
        <span className="text-2xl">🔒</span>
        <div className="text-sm text-blue-800">
          <strong>安全保障：</strong>
          所有 Skill 须通过人工审核方可上架；权限声明完全透明可查；包文件提供 SHA256 校验。
        </div>
      </section>

      {/* Featured */}
      {(featuredLoading || featured.length > 0) && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">✨ 精选 Skill</h2>
            <Link to="/skills?featured=true" className="text-sm text-blue-600 hover:text-blue-700">
              查看全部
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
          <h2 className="text-lg font-semibold text-gray-900">🆕 最新发布</h2>
          <Link to="/skills" className="text-sm text-blue-600 hover:text-blue-700">
            浏览全部
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
