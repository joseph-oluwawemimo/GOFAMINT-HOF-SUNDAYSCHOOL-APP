import { SyncPayload } from '../types';

export async function checkServerHealth(customHost?: string): Promise<{
  ok: boolean;
  data?: any;
  error?: string;
}> {
  const baseUrl = customHost ? customHost.replace(/\/$/, '') : '';
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, data };
    }
    return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Server unreachable or offline' };
  }
}

export async function pushSyncToServer(payload: SyncPayload, customHost?: string): Promise<{
  success: boolean;
  message?: string;
  timestamp?: string;
  error?: string;
}> {
  const baseUrl = customHost ? customHost.replace(/\/$/, '') : '';
  try {
    const res = await fetch(`${baseUrl}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, ...data };
    }
    const errData = await res.json().catch(() => ({}));
    return { success: false, error: errData.error || `Server responded with ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Sync failed due to network' };
  }
}

export async function pullSyncFromServer(customHost?: string): Promise<{
  success: boolean;
  payload?: SyncPayload;
  error?: string;
}> {
  const baseUrl = customHost ? customHost.replace(/\/$/, '') : '';
  try {
    const res = await fetch(`${baseUrl}/api/sync/pull`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, payload: data };
    }
    return { success: false, error: `Failed with status ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message || 'Could not reach server' };
  }
}

export async function generateGeminiContent(params: {
  type: 'WHATSAPP_FOLLOWUP' | 'PASTORAL_REPORT' | 'LESSON_INSIGHTS';
  memberName?: string;
  status?: string;
  weeksAbsent?: number;
  prayerRequest?: string;
  lessonTopic?: string;
  memoryVerse?: string;
  memoryVerseRef?: string;
  teacherName?: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/gemini/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const data = await res.json();
      return data.text || '';
    }
    throw new Error('AI service error');
  } catch (err: any) {
    console.warn('AI assistant fallback:', err);
    // Fallback template
    return `Dear ${params.memberName || 'Beloved in Christ'},\n\nWe warmly missed you in our GOFAMINT_HOF Sunday School class! Our lesson topic was "${params.lessonTopic || 'Walking with God'}" (${params.memoryVerseRef || 'Scripture'}). We are upholding you in prayer concerning your request: "${params.prayerRequest || 'Grace and divine health'}". May God's peace surround you this week!\n\nIn Christ's Love,\n${params.teacherName || 'Sunday School Secretary'}`;
  }
}

export async function askGeminiSecretaryAssistant(
  prompt: string,
  history?: Array<{ role: string; content: string }>,
  contextData?: any
): Promise<{ reply: string; model?: string }> {
  try {
    const res = await fetch('/api/gemini/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'CHAT',
        prompt,
        history,
        contextData
      }),
      signal: AbortSignal.timeout(20000)
    });
    if (res.ok) {
      const data = await res.json();
      return { reply: data.text || data.reply || '', model: data.model };
    }
    throw new Error('AI service returned non-200 response');
  } catch (err: any) {
    console.warn('AI assistant call fallback:', err);
    const promptLower = (prompt || '').toLowerCase();
    if (promptLower.includes('whatsapp') || promptLower.includes('absent')) {
      return {
        reply: `Dear Beloved in Christ,\n\nWarm greetings in Jesus' precious name! We truly missed your active presence and warmth in Sunday School today. We are fervently praying for you and trusting God for your strength. Please let us know if there is any specific way we can minister to you this week!\n\nYours in His Vineyard,\nGOFAMINT_HOF Sunday School Secretary`
      };
    }
    return {
      reply: `GOFAMINT_HOF Sunday School Assistant Guidance:\n\n1. Ensure punctual attendance and memory verse recitation are recorded accurately for all members.\n2. For visitors with 2+ consecutive attendances, initiate the visitor-to-student conversion workflow.\n3. Escalate absences past 2 weeks for pastoral follow-up.`
    };
  }
}

