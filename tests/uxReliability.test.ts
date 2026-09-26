import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { WorkersDirectoryView } from '../src/components/WorkersModule/WorkersDirectoryView';

test('Workers Directory renders real React icon components without a browser-constructor crash', () => {
  assert.doesNotThrow(() => renderToString(
    React.createElement(WorkersDirectoryView, {
      workers: [],
      categoriesList: [],
      departmentsList: [],
      onAddWorker: () => undefined,
      onBulkImport: () => undefined,
      onEditWorker: () => undefined,
      onDeleteWorker: () => undefined,
      onViewQrPass: () => undefined,
      onQuickClockIn: () => undefined,
      onNavigateToTab: () => undefined,
    })
  ));
});
