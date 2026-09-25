export type SupportedAuthEvent =
  | 'INITIAL_SESSION'
  | 'PASSWORD_RECOVERY'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'MFA_CHALLENGE_VERIFIED'
  | string;

/** Token refreshes keep the last-good UI mounted for the same identity. */
export function shouldResolveProfileForAuthEvent(
  event: SupportedAuthEvent,
  userId: string | null,
  resolvedUserId: string | null,
  resolvingUserId: string | null
): boolean {
  if (!userId || resolvingUserId === userId) return false;
  if (resolvedUserId !== userId) return true;
  return event === 'USER_UPDATED';
}
