import { SSSRDeliveryRecord } from '../types';

export function mergeSSSRDeliveryMaps(
  ...maps: Array<Record<string, SSSRDeliveryRecord> | null | undefined>
): Record<string, SSSRDeliveryRecord> {
  const merged: Record<string, SSSRDeliveryRecord> = {};
  for (const map of maps) {
    for (const [id, record] of Object.entries(map || {})) {
      const existing = merged[id];
      const incomingTime = Date.parse(record?.updatedAt || '') || 0;
      const existingTime = Date.parse(existing?.updatedAt || '') || 0;
      if (!existing || incomingTime >= existingTime) merged[id] = record;
    }
  }
  return merged;
}

