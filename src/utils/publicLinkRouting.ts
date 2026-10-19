export type PublicLinkTokens = {
  visitorToken: string | null;
  reportCardToken: string | null;
};

function tokenFromHash(hash: string, routes: string[]): string | null {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const [hashPath, hashQuery = ''] = normalizedHash.split('?');
  const routePattern = routes.map(route => route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pathMatch = hashPath.match(new RegExp(`^/?(?:${routePattern})/([a-zA-Z0-9_-]+)$`, 'i'));
  if (pathMatch?.[1]) return pathMatch[1];

  const routeOnlyMatch = hashPath.match(new RegExp(`^/?(?:${routePattern})/?$`, 'i'));
  if (!routeOnlyMatch) return null;
  const params = new URLSearchParams(hashQuery);
  return params.get('token');
}

/**
 * Resolves passwordless public links without confusing registration links with
 * report-card links. Hash query strings are supported for links already sent
 * before this routing fix.
 */
export function resolvePublicLinkTokens(urlLike: string): PublicLinkTokens {
  const url = new URL(urlLike, 'https://gofamint-hof.local');
  const visitorToken = tokenFromHash(url.hash, [
    'visitor-profile',
    'member-profile',
    'profile-link',
    'student-profile'
  ]) || url.searchParams.get('visitor_token') || url.searchParams.get('profile_token');

  const reportCardToken = tokenFromHash(url.hash, ['report-card', 'student-report'])
    || url.searchParams.get('report_card_token')
    || url.searchParams.get('student_report_token')
    || url.searchParams.get('student_token');

  return { visitorToken, reportCardToken };
}

