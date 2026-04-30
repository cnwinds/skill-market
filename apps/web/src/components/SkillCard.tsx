import { Link } from 'react-router-dom';
import type { MarketSkillSummary } from '@qizhi/skill-spec';
import KindBadge from './KindBadge';

interface Props {
  skill: MarketSkillSummary;
}

export default function SkillCard({ skill }: Props) {
  const [publisher, name] = skill.id.split('/');
  const displayName = skill.displayName ?? skill.id;

  return (
    <Link
      to={`/skills/${publisher}/${name}`}
      className="block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
              {displayName}
            </h3>
            <KindBadge kind={skill.kind} />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{skill.id}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{skill.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            <span>v{skill.latestVersion}</span>
            <span>{skill.author.name}</span>
            {skill.categories[0] && <span>{skill.categories[0]}</span>}
          </div>
          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skill.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
