import versionInfo from '~/version.json';

/**
 * Build marker shown in the header. The build number comes from app/version.json, which the
 * pre-commit hook bumps on every commit, so it is a straightforward way to confirm which
 * revision the deployed instance is actually running.
 */
export function VersionBadge() {
  return (
    <span
      title={`Cresova Builder v${versionInfo.version} · build ${versionInfo.build} · ${versionInfo.date}`}
      className="hidden sm:flex items-center gap-1.5 rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-2.5 py-1 text-xs text-bolt-elements-textSecondary select-none"
    >
      <span className="i-ph:git-commit-duotone text-sm text-accent" />
      <span className="font-medium text-bolt-elements-textPrimary">v{versionInfo.version}</span>
      <span className="text-bolt-elements-textTertiary">build {versionInfo.build}</span>
    </span>
  );
}
