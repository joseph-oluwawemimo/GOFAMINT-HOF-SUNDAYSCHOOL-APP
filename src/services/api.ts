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
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI service failed (${res.status}).`);
  } catch (err: any) {
    throw new Error(err?.message || 'The AI assistant is unavailable.');
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
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `AI service failed (${res.status}).`);
  } catch (err: any) {
    throw new Error(err?.message || 'The AI assistant is unavailable.');
  }
}

