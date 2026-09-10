export interface PendingCloudOperation {
  collectionName: string;
  action: 'save' | 'delete';
  docId: string;
  data?: unknown;
}

/** Overlay unsent local changes on a cloud snapshot before replacing a cache. */
export function protectPendingCloudChanges<T>(
  cloudItems: readonly T[],
  pending: readonly PendingCloudOperation[],
  collectionName: string
): T[] {
  const byId = new Map<string, T>();
  for (const item of cloudItems) {
    const itemId = String((item as any)?.id || (item as any)?.name || '');
    if (itemId) byId.set(itemId, item);
  }
  for (const operation of pending) {
    if (operation.collectionName !== collectionName) continue;
    if (operation.action === 'delete') byId.delete(operation.docId);
    else if (operation.data) byId.set(operation.docId, operation.data as T);
  }
  return Array.from(byId.values());
}
