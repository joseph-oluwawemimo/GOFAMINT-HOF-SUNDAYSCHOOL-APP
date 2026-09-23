/**
 * GOFAMINT SIB AI Provider Abstraction
 * 
 * Defines the contract for intelligence providers so that Gemini (or any
 * future alternative) can be swapped without touching SIB UI or calculations.
 */

import { SIBQueryRequest, SIBStructuredResponse, SIBWeeklyReportResponse } from './agentTypes';

export interface ISibAiProvider {
  name: string;
  queryIntelligence(request: SIBQueryRequest): Promise<SIBStructuredResponse>;
  generateWeeklyReport(quarterNumber: number): Promise<SIBWeeklyReportResponse>;
}
