import type { SkillKind } from '@qizhi/skill-spec';

const kindLabels: Record<SkillKind, { label: string; className: string }> = {
  instruction: { label: '指令', className: 'bg-purple-100 text-purple-700' },
  runtime: { label: '运行时', className: 'bg-green-100 text-green-700' },
  hybrid: { label: '混合', className: 'bg-blue-100 text-blue-700' },
};

export default function KindBadge({ kind }: { kind: SkillKind }) {
  const { label, className } = kindLabels[kind];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${className}`}>{label}</span>
  );
}
