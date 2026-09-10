export function canonicalizeClassId(value?: string | null): string {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isExactClassAssignment(
  assignedClassId?: string | null,
  targetClassId?: string | null
): boolean {
  const assigned = canonicalizeClassId(assignedClassId);
  const target = canonicalizeClassId(targetClassId);
  return assigned.length > 0 && target.length > 0 && assigned === target;
}

export function isApprovedClassStatus(status?: string | null): boolean {
  return String(status || '').trim().toUpperCase() === 'APPROVED';
}
