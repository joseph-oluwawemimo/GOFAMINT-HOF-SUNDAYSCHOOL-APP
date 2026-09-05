import { WorkerProfile } from '../types';

export interface ProfileCompletenessResult {
  percentage: number;
  missingFields: string[];
  isComplete: boolean;
}

/**
 * Calculates profile completeness percentage (0 to 100) and lists missing fields.
 */
export function calculateWorkerProfileCompleteness(worker: WorkerProfile): ProfileCompletenessResult {
  let score = 0;
  const missingFields: string[] = [];

  // Full Name (20%)
  if (worker.fullName && worker.fullName.trim().length > 0) {
    score += 20;
  } else {
    missingFields.push('Full Name');
  }

  // Department (20%)
  if (worker.department && worker.department.trim().length > 0 && worker.department !== 'Unassigned') {
    score += 20;
  } else {
    missingFields.push('Department');
  }

  // Phone Number (20%)
  if (worker.phone && worker.phone.trim().length >= 7) {
    score += 20;
  } else {
    missingFields.push('Phone Number');
  }

  // Class / Role / Duty (15%)
  if ((worker.assignedClass && worker.assignedClass !== '-') || (worker.duty && worker.duty.trim().length > 0)) {
    score += 15;
  } else {
    missingFields.push('Assigned Class / Duty');
  }

  // WhatsApp Number (10%)
  if (worker.whatsappNumber && worker.whatsappNumber.trim().length >= 7) {
    score += 10;
  } else {
    missingFields.push('WhatsApp Number');
  }

  // Address (10%)
  if (worker.address && worker.address.trim().length > 0 && worker.address !== 'Assembly District') {
    score += 10;
  } else {
    missingFields.push('Address');
  }

  // Gender (5%)
  if (worker.gender === 'MALE' || worker.gender === 'FEMALE') {
    score += 5;
  } else {
    missingFields.push('Gender');
  }

  return {
    percentage: score,
    missingFields,
    isComplete: score >= 80
  };
}
