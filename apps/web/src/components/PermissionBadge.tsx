import type { SkillPermissions } from '@qizhi/skill-spec';

interface Props {
  permissions: SkillPermissions;
  compact?: boolean;
}

export default function PermissionBadge({ permissions, compact = false }: Props) {
  const badges: { label: string; className: string; title?: string }[] = [];

  if (permissions.scripts) {
    badges.push({
      label: compact ? '高风险' : '高风险：可执行脚本',
      className: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      title: 'scripts=true: 该 Skill 可执行系统脚本',
    });
  }

  const network = permissions.network;
  if (network === true) {
    badges.push({
      label: compact ? '网络' : '网络访问（不限制域名）',
      className: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
    });
  } else if (network && typeof network === 'object' && network.allowedHosts.length > 0) {
    badges.push({
      label: compact ? '网络' : `网络：${network.allowedHosts.slice(0, 2).join(', ')}${network.allowedHosts.length > 2 ? '…' : ''}`,
      className: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
      title: `允许访问：${network.allowedHosts.join(', ')}`,
    });
  }

  if (permissions.secrets.length > 0) {
    badges.push({
      label: compact ? '密钥' : `需要密钥: ${permissions.secrets.slice(0, 2).join(', ')}${permissions.secrets.length > 2 ? '…' : ''}`,
      className: 'bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
      title: `需要密钥: ${permissions.secrets.join(', ')}`,
    });
  }

  const readPerms = permissions.filesystem.filter((p) => p.endsWith(':read'));
  const writePerms = permissions.filesystem.filter((p) => p.endsWith(':write'));

  if (readPerms.length > 0) {
    badges.push({
      label: compact ? '文件读' : `文件读: ${readPerms.map((p) => p.replace(':read', '')).join(', ')}`,
      className: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    });
  }
  if (writePerms.length > 0) {
    badges.push({
      label: compact ? '文件写' : `文件写: ${writePerms.map((p) => p.replace(':write', '')).join(', ')}`,
      className: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    });
  }

  if (badges.length === 0) {
    return compact ? null : (
      <span className="text-xs text-gray-400 dark:text-gray-500">无特殊权限</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b, i) => (
        <span
          key={i}
          title={b.title}
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.className}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
