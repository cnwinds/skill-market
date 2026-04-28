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
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-xl shrink-0">
          ⚡
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 truncate">
              {displayName}
            </h3>
            <KindBadge kind={skill.kind} />
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{skill.id}</p>
          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{skill.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>v{skill.latestVersion}</span>
            <span>{skill.author.name}</span>
            {skill.categories[0] && <span>{skill.categories[0]}</span>}
          </div>
          {skill.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skill.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded"
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
