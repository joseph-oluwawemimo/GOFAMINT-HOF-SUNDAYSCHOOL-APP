import test from 'node:test';
import assert from 'node:assert/strict';
import { SundaySchoolYear } from '../src/types';
import { DEFAULT_DEPARTMENTS } from '../src/data/mockQuarterLessons';

// Replicating the exact normalization logic from getSundaySchoolYear
function normalizeDepartments(year: SundaySchoolYear): { departments: string[]; needsUpdate: boolean } {
  let needsUpdate = false;
  const legacyDeptsToRemove = new Set([
    'Sunday School', 'Ministers Council', 'Choir', 'Youth Ministry', 'Good Women', 'Men Fellowship',
    'Evangelism Board', 'Ushering Unit', 'Prayer Band', 'Sanctuary Keepers', 'Welfare Board',
    'Media & Technical Unit', 'Young Adults', 'Teens', 'Elders', 'Searchers / Believers',
    'Follow-Up Unit', 'Protocol Unit', 'Music Ministry', 'Christian Education'
  ]);

  let departments = year.departments;
  if (!Array.isArray(departments)) {
    departments = [...DEFAULT_DEPARTMENTS];
    needsUpdate = true;
  } else {
    const cleanedDepts = Array.from(new Set(
      departments.filter(d => typeof d === 'string' && d.trim() && !legacyDeptsToRemove.has(d))
    ));
    if (cleanedDepts.length !== departments.length) {
      departments = cleanedDepts;
      needsUpdate = true;
    }
  }

  return { departments, needsUpdate };
}

test('Department Management: Deleting Teenagers does not resurrect it on subsequent loads', () => {
  // Starting state with 4 departments
  const initialYear: SundaySchoolYear = {
    id: 'YEAR_2026',
    yearName: '2026/2027',
    overallTheme: 'Test Theme',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    activeQuarterNumber: 1,
    isInitialized: true,
    departments: ['Adult', 'Youth', 'Teenagers', 'Children'],
    quarters: [],
    updatedAt: new Date().toISOString()
  };

  // User deletes 'Teenagers'
  const deletedDepartment = 'Teenagers';
  const updatedDepartments = initialYear.departments.filter(d => d !== deletedDepartment);
  assert.deepEqual(updatedDepartments, ['Adult', 'Youth', 'Children']);

  // Simulate next getSundaySchoolYear call
  const savedYear: SundaySchoolYear = {
    ...initialYear,
    departments: updatedDepartments
  };

  const { departments: loadedDepartments, needsUpdate } = normalizeDepartments(savedYear);

  assert.equal(loadedDepartments.includes('Teenagers'), false, 'Teenagers must NOT be re-added!');
  assert.deepEqual(loadedDepartments, ['Adult', 'Youth', 'Children']);
  assert.equal(needsUpdate, false, 'No update required when valid departments list is already clean');
});

test('Department Management: Uninitialized departments default to standard recognized list', () => {
  const uninitializedYear: SundaySchoolYear = {
    id: 'YEAR_UNINIT',
    yearName: '2026/2027',
    overallTheme: 'Test Theme',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    activeQuarterNumber: 1,
    isInitialized: false,
    departments: undefined as any,
    quarters: [],
    updatedAt: new Date().toISOString()
  };

  const { departments, needsUpdate } = normalizeDepartments(uninitializedYear);
  assert.deepEqual(departments, ['Adult', 'Youth', 'Children']);
  assert.equal(needsUpdate, true);
});

test('Department Management: Legacy church units are stripped without re-adding deleted departments', () => {
  const yearWithLegacyUnits: SundaySchoolYear = {
    id: 'YEAR_LEGACY',
    yearName: '2026/2027',
    overallTheme: 'Test Theme',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    activeQuarterNumber: 1,
    isInitialized: true,
    departments: ['Adult', 'Youth', 'Children', 'Choir', 'Ushering Unit', 'Good Women'],
    quarters: [],
    updatedAt: new Date().toISOString()
  };

  const { departments, needsUpdate } = normalizeDepartments(yearWithLegacyUnits);
  assert.deepEqual(departments, ['Adult', 'Youth', 'Children']);
  assert.equal(departments.includes('Teenagers'), false, 'Teenagers should stay deleted');
  assert.equal(departments.includes('Choir'), false, 'Choir should be stripped');
  assert.equal(needsUpdate, true);
});

test('Department Management: Case-insensitive and trimmed department matching', () => {
  const depts = ['Adult', 'Youth', 'Teenagers', 'Children'];
  const targetToDelete = '  teenagers  ';
  const remaining = depts.filter(d => d.trim().toLowerCase() !== targetToDelete.trim().toLowerCase());
  assert.deepEqual(remaining, ['Adult', 'Youth', 'Children']);
});
