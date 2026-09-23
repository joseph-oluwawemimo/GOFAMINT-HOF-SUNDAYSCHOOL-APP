/**
 * GOFAMINT SIB Gemini Provider Implementation
 * 
 * Communicates with the authenticated server-side SIB Agent endpoint.
 * Protects secrets: GEMINI_API_KEY is NEVER exposed to the client browser.
 */

import { ISibAiProvider } from './aiProvider';
import { SIBQueryRequest, SIBStructuredResponse, SIBWeeklyReportResponse } from './agentTypes';
import { getAccessToken } from '../../services/authService';

export class SibGeminiProvider implements ISibAiProvider {
  public readonly name = 'Gemini AI Agent (Google GenAI)';

  public async queryIntelligence(request: SIBQueryRequest): Promise<SIBStructuredResponse> {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/sib/query', {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `SIB Agent request failed (${response.status})`);
    }

    return await response.json();
  }

  public async generateWeeklyReport(quarterNumber: number): Promise<SIBWeeklyReportResponse> {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch('/api/sib/weekly-report', {
      method: 'POST',
      headers,
      body: JSON.stringify({ quarterNumber }),
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `SIB Weekly Report request failed (${response.status})`);
    }

    return await response.json();
  }
}

export const sibAiProvider = new SibGeminiProvider();
