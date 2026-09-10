export function hasInitializedSystem(configInitialized: unknown, existingRecordCounts: readonly number[]): boolean {
  return configInitialized === true || existingRecordCounts.some(count => Number.isFinite(count) && count > 0);
}
