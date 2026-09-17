import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { GOFAMINT_ROLES, getBearerToken, getSupabaseAdmin, provisionSupabaseUserProfile, type GofamintRole } from './supabaseAdmin.js';
import { hasInitializedSystem } from '../utils/systemInitialization.js';
import { normalizeClassLoginIdentifier } from '../utils/loginIdentifier.js';

const EXEC: GofamintRole[] = ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY'];
const APPROVERS: GofamintRole[] = ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY'];
const ADMIN_PROFILES = new Set<GofamintRole>([...EXEC, 'DEPARTMENT_SUPERINTENDENT', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY', 'TREASURER', 'RECORD_OFFICER', 'ENROLLMENT_OFFICER']);
const CLASS_ADMINS: GofamintRole[] = ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'];
const CLASS_CREATORS: GofamintRole[] = ['ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'];
const CLASS_PORTAL_ROLES: GofamintRole[] = ['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY'];
const WORKER_MANAGERS = new Set<GofamintRole>([...EXEC, 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY']);
const WORKER_EVENT_READERS = new Set<GofamintRole>([...WORKER_MANAGERS, 'RECORD_OFFICER', 'WORKER']);
const WORKER_DIRECTORY_READERS = new Set<GofamintRole>([...WORKER_EVENT_READERS, ...CLASS_PORTAL_ROLES]);
type Caller = { id: string; email: string | null; role: GofamintRole; classId: string | null; departmentId: string | null };

function limitedText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function canonicalClassId(value: unknown): string {
  return limitedText(value, 120).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function buildAssistantPrompt(body: Record<string, unknown>): string {
  const type = limitedText(body.type, 40);
  if (type === 'CHAT') {
    const prompt = limitedText(body.prompt, 4_000);
    if (!prompt) throw new Error('A non-empty assistant prompt is required.');
    const history = Array.isArray(body.history)
      ? body.history.slice(-10).map((item: any) => `${limitedText(item?.role, 20)}: ${limitedText(item?.content, 1_000)}`).join('\n')
      : '';
    const context = body.contextData == null ? '' : limitedText(JSON.stringify(body.contextData), 12_000);
    return [
      'You are the GOFAMINT House of Favour Sunday School administrative assistant. Be concise, pastoral, accurate, and never invent attendance or financial records.',
      history ? `Recent conversation:\n${history}` : '',
      context ? `Application context:\n${context}` : '',
      `Current request:\n${prompt}`,
    ].filter(Boolean).join('\n\n');
  }

  const memberName = limitedText(body.memberName, 120) || 'Beloved in Christ';
  const lessonTopic = limitedText(body.lessonTopic, 300) || 'Walking with God';
  const memoryVerse = limitedText(body.memoryVerse, 500);
  const memoryVerseRef = limitedText(body.memoryVerseRef, 120);
  const prayerRequest = limitedText(body.prayerRequest, 500);
  const teacherName = limitedText(body.teacherName, 120) || 'Sunday School Secretary';
  const weeksAbsent = Number.isFinite(Number(body.weeksAbsent)) ? Math.max(0, Math.min(52, Number(body.weeksAbsent))) : 0;

  if (type === 'WHATSAPP_FOLLOWUP') {
    return `Write a warm, concise WhatsApp pastoral follow-up for ${memberName}, absent for ${weeksAbsent} week(s). Lesson: ${lessonTopic}. Memory verse: ${memoryVerseRef} ${memoryVerse}. Prayer request: ${prayerRequest || 'not provided'}. Sign as ${teacherName}. Do not claim that contact or prayer already occurred.`;
  }
  if (type === 'PASTORAL_REPORT') {
    return `Write a concise pastoral care report for ${memberName}. Status: ${limitedText(body.status, 100)}. Consecutive weeks absent: ${weeksAbsent}. Prayer request: ${prayerRequest || 'not provided'}. Use only these facts and clearly label any recommended next action.`;
  }
  if (type === 'LESSON_INSIGHTS') {
    return `Provide concise, biblically grounded Sunday School teaching insights for the topic "${lessonTopic}". Scripture/memory verse: ${memoryVerseRef} ${memoryVerse}. Include three discussion prompts and one practical application.`;
  }
  throw new Error('Unsupported assistant request type.');
}

async function caller(req: Request, res: Response, allowed?: GofamintRole[]): Promise<Caller | null> {
  const token = getBearerToken(req.headers.authorization);
  if (!token) { res.status(401).json({ error: 'Missing sign-in token.' }); return null; }
  const db = getSupabaseAdmin();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) {
    let tokenIssuer: string | null = null;
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'));
      tokenIssuer = typeof payload?.iss === 'string' ? payload.iss : null;
    } catch (decodeError) {
      console.error('[Server] Bearer token payload could not be decoded:', decodeError);
    }
    console.error('[Server] Supabase bearer validation failed:', {
      operation: `${req.method} ${req.path}`,
      reason: authError?.message || 'Supabase returned no authenticated user.',
      tokenIssuer,
      configuredProjectHost: process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null,
    });
    const developmentReason = process.env.NODE_ENV !== 'production' && authError?.message
      ? ` (${authError.message})`
      : '';
    res.status(401).json({ error: `Invalid or expired sign-in token${developmentReason}.` });
    return null;
  }
  let { data: p, error } = await db.from('profiles').select('id,email,role,is_approved,class_id,department_id').eq('id', auth.user.id).maybeSingle();
  if (error && /department_id/i.test(error.message || '')) {
    const fallback = await db.from('profiles').select('id,email,role,is_approved,class_id').eq('id', auth.user.id).maybeSingle();
    p = fallback.data ? { ...fallback.data, department_id: null } as any : null;
    error = fallback.error;
  }
  if (error || !p || !p.is_approved || !GOFAMINT_ROLES.includes(p.role as GofamintRole)) { res.status(403).json({ error: 'An approved application profile is required.' }); return null; }
  const result = { id: p.id, email: p.email || auth.user.email || null, role: p.role as GofamintRole, classId: p.class_id || null, departmentId: p.department_id || null };
  if (allowed && !allowed.includes(result.role)) { res.status(403).json({ error: 'You do not have permission for this operation.' }); return null; }
  return result;
}
async function audit(actor: Caller | null, action: string, details: Record<string, unknown>, entityType?: string, entityId?: string) {
  const { error } = await getSupabaseAdmin().from('audit_logs').insert({ actor_id: actor?.id || null, action, entity_type: entityType || null, entity_id: entityId || null, details });
  if (error) throw error;
}
function email(raw: string) { const v = String(raw || '').trim(); return v.includes('@') ? v.toLowerCase() : `class_${v.toLowerCase().replace(/[^a-z0-9_]/g, '')}@gofamint-hof.internal`; }
function initialYear(id: string) {
  const names = ['First Quarter', 'Second Quarter', 'Third Quarter', 'Fourth Quarter'];
  return { id, yearName: `${new Date().getFullYear()}–${new Date().getFullYear() + 1}`, overallTheme: '', startDate: '', endDate: '', activeQuarterNumber: 1, isInitialized: false, departments: [], updatedAt: new Date().toISOString(), quarters: [1,2,3,4].map(n => ({ id: `Q${n}_${id}`, quarterNumber:n, quarterName:names[n-1], quarterTheme:'', startDate:'', endDate:'', sharingAdmonitionDate:'', totalLessonWeeks:12, hasSharingAdmonitionWeek:true, status:n===1?'ACTIVE':'UPCOMING', isDistributed:false, lessons:[], updatedAt:new Date().toISOString() })) };
}

async function readSystemInitializationState(db: ReturnType<typeof getSupabaseAdmin>): Promise<{ initialized: boolean; schemaVersion: number; inferredFromExistingData: boolean }> {
  const { data: config, error: configError } = await db.from('system_config')
    .select('initialized,schema_version').eq('id', 'initialization').maybeSingle();
  if (configError) throw configError;
  if (config?.initialized === true) {
    return { initialized: true, schemaVersion: config.schema_version || 0, inferredFromExistingData: false };
  }

  const checks = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('sunday_school_years').select('id', { count: 'exact', head: true }),
    db.from('classes').select('id', { count: 'exact', head: true }),
  ]);
  for (const check of checks) if (check.error) throw check.error;
  const inferred = hasInitializedSystem(false, checks.map(check => check.count || 0));
  return { initialized: inferred, schemaVersion: config?.schema_version || 0, inferredFromExistingData: inferred };
}

export function createApp() {
  const app = express(); app.use(express.json({ limit: '50mb' }));
  app.get('/api/health', (_q, r) => r.json({ status: 'ok', provider: 'supabase' }));
  const SERVER_START_TIME = Date.now();
  app.get('/api/version', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.json({
      version: process.env.BUILD_TIME || String(SERVER_START_TIME),
      serverStartTime: SERVER_START_TIME,
      timestamp: Date.now()
    });
  });
  app.post('/api/gemini/assistant', async (req, res) => {
    try {
      const c = await caller(req, res);
      if (!c) return;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'The Gemini assistant is not configured on this server.' });
      const contents = buildAssistantPrompt(req.body || {});
      const ai = new GoogleGenAI({ apiKey });
      const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      const response = await ai.models.generateContent({ model, contents });
      const generatedText = response.text?.trim();
      if (!generatedText) throw new Error('Gemini returned an empty response.');
      res.json({ text: generatedText, model });
    } catch (e: any) {
      const message = e?.message || 'The Gemini assistant request failed.';
      const status = message.includes('required') || message.includes('Unsupported') ? 400 : 502;
      console.error('[Server] Gemini assistant error:', message);
      res.status(status).json({ error: message });
    }
  });
  app.get('/api/system/status', async (_q, r) => {
    try { r.json(await readSystemInitializationState(getSupabaseAdmin())); }
    catch (e:any) {
      console.error('[Server] system status error:', e);
      r.status(500).json({ error: e.message || 'Could not read system status.' });
    }
  });
  app.post('/api/admin/bootstrap', async (req, r) => {
    const db = getSupabaseAdmin(); let userId: string | null = null; let bootstrapLockClaimed = false;
    try {
      const state = await readSystemInitializationState(db);
      if (state.initialized) return r.status(409).json({ error: 'System has already been initialized or contains existing records.' });
      const { bootstrapSecret, churchName, superintendent } = req.body || {}; const officer = superintendent; const role: GofamintRole = 'GENERAL_SUPERINTENDENT';
      if (!process.env.BOOTSTRAP_SECRET || bootstrapSecret !== process.env.BOOTSTRAP_SECRET) return r.status(401).json({ error: 'Invalid bootstrap secret.' });
      if (!String(churchName || '').trim() || !officer?.email || !officer?.password || !officer?.displayName || officer.password.length < 6) return r.status(400).json({ error: 'Church name, officer email, password (minimum 6 characters), and full name are required.' });
      // A unique row provides a database-level first-run mutex. It prevents
      // concurrent valid requests from creating two initial executive users.
      const { error: lockError } = await db.from('system_config').insert({ id: 'bootstrap_lock', initialized: true, data: { claimedAt: new Date().toISOString() } });
      if (lockError) return r.status(409).json({ error: 'System initialization is already in progress or has completed.' });
      bootstrapLockClaimed = true;
      const bootstrapProvision = await provisionSupabaseUserProfile({ email:email(officer.email), password:officer.password, displayName:officer.displayName.trim(), role, isApproved:true });
      userId = bootstrapProvision.userId;
      const year = initialYear(`YEAR_${Date.now()}`);
      for (const result of await Promise.all([
        db.from('admin_profiles').insert({ id:userId, profile_id:userId, role_type:role, title:`${role.replace(/_/g,' ')} ID`, profile_name:officer.displayName.trim(), username:email(officer.email), is_approved:true, approved_at:bootstrapProvision.approvedAt }),
        db.from('sunday_school_years').insert({ id:year.id, data:year, updated_at:new Date().toISOString() }),
        db.from('system_config').upsert({ id:'initialization', initialized:true, schema_version:1, data:{ initializedAt:new Date().toISOString(), initializedBy:userId, churchName:String(churchName).trim(), currentYearId:year.id } }, { onConflict:'id' }),
      ])) if (result.error) throw result.error;
      await audit(null, 'SYSTEM_BOOTSTRAP', { officerId:userId, role, yearId:year.id }, 'system_config', 'initialization');
      r.json({ success:true, uid:userId, roleType:role, yearId:year.id, message:'System initialized successfully.' });
    } catch (e:any) {
      console.error('[Server] system bootstrap error:', e);
      if (userId) {
        await db.auth.admin.deleteUser(userId).catch(cleanupError => {
          console.error('[Server] failed to remove partially-created bootstrap user:', cleanupError);
        });
      }
      if (bootstrapLockClaimed) {
        const { error: cleanupError } = await db.from('system_config').delete().eq('id', 'bootstrap_lock');
        if (cleanupError) console.error('[Server] failed to release bootstrap lock:', cleanupError);
      }
      r.status(500).json({ error:e.message || 'Bootstrap failed.' });
    }
  });
  app.get('/api/admin/list-users', async (req,r) => {
    try {
      const c=await caller(req,r,EXEC); if(!c)return;
      const db = getSupabaseAdmin();
      let { data, error } = await db.from('profiles').select('id,email,display_name,role,class_id,worker_id,department_id,is_approved,created_at,approved_by,approved_at').order('created_at');
      if (error && /department_id/i.test(error.message || '')) {
        const fallback = await db.from('profiles').select('id,email,display_name,role,class_id,worker_id,is_approved,created_at,approved_by,approved_at').order('created_at');
        data = fallback.data?.map(profile => ({ ...profile, department_id: null })) as any;
        error = fallback.error;
      }
      if(error)throw error;
      r.json({success:true,users:(data||[]).map(p=>({uid:p.id,email:p.email,displayName:p.display_name,roleType:p.role,classId:p.class_id,workerId:p.worker_id,departmentId:p.department_id,isApproved:p.is_approved,createdAt:p.created_at,approvedBy:p.approved_by,approvedAt:p.approved_at}))});
    } catch(e:any){r.status(500).json({error:e.message||'Failed to list users.'});}
  });
  app.post('/api/admin/create-user', async (req,r) => {
    const db=getSupabaseAdmin(); let userId:string|null=null;
    try { const c=await caller(req,r); if(!c)return; const {email:raw,password,roleType,displayName,classId,workerId}=req.body||{}; const departmentId=limitedText(req.body?.departmentId,120);
      if(!raw||!password||password.length<6||!GOFAMINT_ROLES.includes(roleType)) return r.status(400).json({error:'Valid email/login ID, password (minimum 6 characters), and roleType are required.'});
      const isClassLogin = CLASS_PORTAL_ROLES.includes(roleType);
      const mayProvision = isClassLogin ? CLASS_CREATORS.includes(c.role) : EXEC.includes(c.role);
      if (!mayProvision) return r.status(403).json({ error: isClassLogin ? 'Only the Assistant General Secretary can create class logins.' : 'Only an executive administrator can create staff logins.' });
      if (isClassLogin && !classId) return r.status(400).json({ error: 'A class assignment is required for teacher and class secretary accounts.' });
      if (roleType === 'DEPARTMENT_SUPERINTENDENT' && !departmentId) return r.status(400).json({ error: 'A department assignment is required for a Departmental Superintendent.' });
      const { count: superintendentCount, error: superintendentCountError } = await db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'GENERAL_SUPERINTENDENT');
      if (superintendentCountError) throw superintendentCountError;
      // Both executive roles may provision ordinary staff.  Bootstrap roles
      // remain protected: a secretary cannot replace the superintendent or
      // create a peer secretary account.
      if (c.role === 'GENERAL_SECRETARY' && ['GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'SUPER_ADMIN'].includes(roleType)) {
        return r.status(403).json({ error: 'General Secretaries may create non-bootstrap staff accounts only.' });
      }
      if(roleType==='GENERAL_SUPERINTENDENT' && superintendentCount)return r.status(409).json({error:'A General Superintendent account already exists.'});
      if (roleType === 'DEPARTMENT_SUPERINTENDENT') {
        const [{ data: department, error: departmentError }, { count: assignedCount, error: assignedError }] = await Promise.all([
          db.from('departments').select('id').eq('id', departmentId).maybeSingle(),
          db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', roleType).eq('department_id', departmentId),
        ]);
        if (departmentError || assignedError) throw departmentError || assignedError;
        if (!department) return r.status(400).json({ error: `Department "${departmentId}" does not exist.` });
        if (assignedCount) return r.status(409).json({ error: `A Departmental Superintendent is already assigned to ${departmentId}.` });
      }
      const pending=['DEPARTMENT_SUPERINTENDENT','ASST_GENERAL_SECRETARY','ASSISTANT_GENERAL_SECRETARY','TREASURER','RECORD_OFFICER','ENROLLMENT_OFFICER'].includes(roleType);
      const provisioned=await provisionSupabaseUserProfile({email:email(raw),password,displayName,role:roleType,isApproved:!pending,classId:classId||null,workerId:workerId||null,departmentId:departmentId||null,createdBy:c.id,approvedBy:pending?null:c.id});userId=provisioned.userId;
      if(classId){
        const {data:existingClass}=await db.from('classes').select('id').eq('id',classId).maybeSingle();
        if(!existingClass){
          await db.from('classes').insert({
            id:classId,
            data:{
              id:classId,
              className:displayName||`Class ${classId}`,
              department:'General',
              isSetupComplete:false,
              approvalStatus:'PENDING_APPROVAL',
              teachers:[],
              secretaryName:'',
              secretaryPhone:'',
              year:new Date().getFullYear(),
              createdAt:new Date().toISOString(),
              updatedAt:new Date().toISOString()
            }
          });
        }
        const {error}=await db.from('profile_class_assignments').upsert({profile_id:userId,class_id:classId});
        if(error)throw error;
      }
      if(ADMIN_PROFILES.has(roleType)){const {error}=await db.from('admin_profiles').insert({id:userId,profile_id:userId,role_type:roleType,title:roleType==='DEPARTMENT_SUPERINTENDENT'?`${departmentId} Departmental Superintendent`:`${roleType.replace(/_/g,' ')} ID`,profile_name:displayName||email(raw),username:email(raw),department_id:departmentId||null,is_approved:!pending,approved_by:!pending?c.id:null,approved_at:provisioned.approvedAt});if(error)throw error;}
      await audit(c,'CREATE_STAFF_LOGIN',{targetUserId:userId,targetEmail:email(raw),targetRole:roleType,departmentId:departmentId||null,isApproved:!pending},'profiles',userId);
      r.json({success:true,uid:userId,roleType,isApproved:!pending,message:pending?'Login created pending approval.':'Login created and active.'});
    } catch (e:any) {
      console.error('[Server] create staff login error:', e);
      if (userId) {
        await db.auth.admin.deleteUser(userId).catch(cleanupError => {
          console.error('[Server] failed to remove partially-created staff user:', cleanupError);
        });
      }
      r.status(500).json({error:e.message||'Failed to create user.'});
    }
  });
  app.post('/api/admin/approve-user', async (req, r) => {
    try {
      const c = await caller(req, r, APPROVERS);
      if (!c) return;
      const id = limitedText(req.body?.targetUid, 100);
      if (!id) return r.status(400).json({ error: 'A specific targetUid is required.' });
      const now = new Date().toISOString();
      const db = getSupabaseAdmin();
      const { data: target, error: targetError } = await db.from('profiles').select('id,email,role').eq('id', id).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return r.status(404).json({ error: 'Target user identity not found.' });

      const { data: updatedProfiles, error: profileError } = await db.from('profiles')
        .update({ is_approved: true, approved_by: c.id, approved_at: now, updated_at: now })
        .eq('id', id)
        .select('id');
      if (profileError) throw profileError;
      if (updatedProfiles?.length !== 1) throw new Error('The target application profile was not updated.');

      if (ADMIN_PROFILES.has(target.role as GofamintRole)) {
        const { data: updatedAdmins, error: adminError } = await db.from('admin_profiles')
          .update({ is_approved: true, approved_by: c.id, approved_at: now, updated_at: now })
          .or(`id.eq.${id},profile_id.eq.${id}`)
          .select('id');
        if (adminError) throw adminError;
        if (updatedAdmins?.length !== 1) throw new Error('The matching administrative profile was not updated.');
      }

      await audit(c, 'APPROVE_STAFF_LOGIN', { targetUserId: id, targetEmail: target.email, targetRole: target.role }, 'profiles', id);
      r.json({ success: true, message: 'Officer profile approved and activated.' });
    } catch (e: any) {
      console.error('[Server] Approve user error:', e);
      r.status(500).json({ error: e.message || 'Failed to approve user.' });
    }
  });
  app.post('/api/admin/delete-user',async(req,r)=>{try{const c=await caller(req,r,EXEC);if(!c)return;const id=req.body?.targetUid;if(!id||id===c.id)return r.status(400).json({error:'A different targetUid is required.'});const db=getSupabaseAdmin();const {data:t,error}=await db.from('profiles').select('email,role').eq('id',id).maybeSingle();if(error||!t)return r.status(404).json({error:'Target user identity not found.'});if(c.role==='GENERAL_SECRETARY'&&['GENERAL_SUPERINTENDENT','GENERAL_SECRETARY'].includes(t.role))return r.status(403).json({error:'Only the General Superintendent can delete executive officer identities.'});const x=await db.auth.admin.deleteUser(id);if(x.error)throw x.error;await audit(c,'DELETE_STAFF_IDENTITY',{targetUserId:id,targetEmail:t.email,targetRole:t.role},'profiles',id);r.json({success:true,message:'Staff login deleted; organizational data was preserved.'});}catch(e:any){r.status(500).json({error:e.message||'Failed to delete user.'});}});
  app.patch('/api/admin/users/:id', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, EXEC); if (!c) return;
      const targetId = limitedText(req.params.id, 100);
      const { data: target, error: targetError } = await db.from('profiles')
        .select('id,email,display_name,role').eq('id', targetId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return r.status(404).json({ error: 'Staff login was not found.' });
      if (c.role === 'GENERAL_SECRETARY' && ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY'].includes(target.role)) {
        return r.status(403).json({ error: 'Only the General Superintendent can edit executive officer logins.' });
      }

      const displayName = req.body?.displayName === undefined ? undefined : limitedText(req.body.displayName, 160);
      const requestedEmail = req.body?.email === undefined ? undefined : limitedText(req.body.email, 320).toLowerCase();
      const password = req.body?.password === undefined ? undefined : String(req.body.password);
      const isClassLogin = CLASS_PORTAL_ROLES.includes(target.role as GofamintRole);
      if (displayName !== undefined && !displayName) return r.status(400).json({ error: 'Full name cannot be empty.' });
      if (requestedEmail !== undefined && (!requestedEmail.includes('@') || isClassLogin)) {
        return r.status(400).json({ error: isClassLogin ? 'Class login IDs cannot be changed here; only their display name and password can be updated.' : 'A valid email address is required.' });
      }
      if (password !== undefined && password.length < 6) return r.status(400).json({ error: 'A new password must contain at least 6 characters.' });
      if (displayName === undefined && requestedEmail === undefined && password === undefined) return r.status(400).json({ error: 'Provide at least one login detail to update.' });

      const now = new Date().toISOString();
      const profilePatch: Record<string, unknown> = { updated_at: now };
      if (displayName !== undefined) profilePatch.display_name = displayName;
      if (requestedEmail !== undefined) profilePatch.email = requestedEmail;
      const { error: profileError } = await db.from('profiles').update(profilePatch).eq('id', targetId);
      if (profileError) throw profileError;

      if (ADMIN_PROFILES.has(target.role as GofamintRole)) {
        const adminPatch: Record<string, unknown> = { updated_at: now };
        if (displayName !== undefined) adminPatch.profile_name = displayName;
        if (requestedEmail !== undefined) adminPatch.username = requestedEmail;
        const { error: adminError } = await db.from('admin_profiles').update(adminPatch).or(`id.eq.${targetId},profile_id.eq.${targetId}`);
        if (adminError) {
          await db.from('profiles').update({ email: target.email, display_name: target.display_name, updated_at: now }).eq('id', targetId);
          throw adminError;
        }
      }

      const authPatch: Record<string, unknown> = {};
      if (displayName !== undefined) authPatch.user_metadata = { display_name: displayName };
      if (requestedEmail !== undefined) { authPatch.email = requestedEmail; authPatch.email_confirm = true; }
      if (password !== undefined) authPatch.password = password;
      const { error: authError } = await db.auth.admin.updateUserById(targetId, authPatch);
      if (authError) {
        await db.from('profiles').update({ email: target.email, display_name: target.display_name, updated_at: now }).eq('id', targetId);
        if (ADMIN_PROFILES.has(target.role as GofamintRole)) {
          await db.from('admin_profiles').update({ username: target.email, profile_name: target.display_name || target.email, updated_at: now }).or(`id.eq.${targetId},profile_id.eq.${targetId}`);
        }
        throw authError;
      }

      await audit(c, 'UPDATE_STAFF_LOGIN', {
        targetUserId: targetId,
        targetRole: target.role,
        emailChanged: requestedEmail !== undefined,
        displayNameChanged: displayName !== undefined,
        passwordReset: password !== undefined,
      }, 'profiles', targetId);
      r.json({ success: true, message: 'Staff login details updated successfully.' });
    } catch (e: any) {
      console.error('[Server] update staff login error:', e);
      r.status(500).json({ error: e.message || 'Failed to update staff login.' });
    }
  });
  app.post('/api/admin/log-oversight',async(req,r)=>{try{const c=await caller(req,r,APPROVERS);if(!c)return;const {targetPortal,targetClassId,action}=req.body||{};await audit(c,'OVERSIGHT_ACCESS',{targetPortal:targetPortal||'DIRECTORATE',targetClassId:targetClassId||null,details:action||'Entered Oversight Mode'},'oversight',targetClassId);r.json({success:true,timestamp:new Date().toISOString()});}catch(e:any){r.status(500).json({error:e.message||'Failed to log oversight access.'});}});
  app.post('/api/admin/reset-year', async (req, r) => {
    try {
      const c = await caller(req, r, APPROVERS); if (!c) return;
      const { confirmYearId, newYearName, newOverallTheme } = req.body || {};
      if (!confirmYearId || !newYearName?.trim()) return r.status(400).json({ error: 'The current year ID and a new year name are required.' });
      const { data: resetData, error } = await getSupabaseAdmin().rpc('gofamint_reset_year', {
        p_confirm_year_id: String(confirmYearId), p_new_year_name: String(newYearName).trim(), p_new_overall_theme: String(newOverallTheme || '').trim(), p_actor_id: c.id,
      }).single();
      if (error) throw error;
      const data = resetData as { new_year_id?: string; classes_reassigned?: number; workers_reassigned?: number } | null;
      await audit(c, 'YEAR_RESET', { previousYearId: confirmYearId, newYearId: data?.new_year_id, newYearName }, 'sunday_school_years', data?.new_year_id);
      r.json({ success: true, newYearId: data?.new_year_id, newYearName, classesReassigned: data?.classes_reassigned || 0, workersReassigned: data?.workers_reassigned || 0 });
    } catch (e: any) { r.status(500).json({ error: e.message || 'Year reset failed.' }); }
  });
  app.post('/api/admin/staged-reset', async (req, r) => {
    try {
      const c = await caller(req, r, ['GENERAL_SUPERINTENDENT']); if (!c) return;
      const scope = limitedText(req.body?.scope, 20).toUpperCase();
      const confirmation = limitedText(req.body?.confirmPhrase, 80).toUpperCase();
      const expected: Record<string, string> = { CLASSES: 'RESET CLASSES', WORKERS: 'RESET WORKERS', ADMINS: 'RESET ADMINS' };
      if (!expected[scope]) return r.status(400).json({ error: 'Reset scope must be CLASSES, WORKERS, or ADMINS.' });
      if (confirmation !== expected[scope]) return r.status(400).json({ error: `Type ${expected[scope]} exactly to authorize this reset.` });
      const { data, error } = await getSupabaseAdmin().rpc('gofamint_staged_reset', { p_scope: scope, p_actor_id: c.id });
      if (error) throw error;
      await audit(c, `STAGED_RESET_${scope}`, { archiveId: data?.archiveId, preResetCounts: data?.preResetCounts }, 'sunday_school_year_archives', data?.archiveId);
      r.json({ success: true, ...data, message: `${scope} data was archived and reset successfully.` });
    } catch (e: any) {
      console.error('[Server] staged reset error:', e);
      r.status(500).json({ error: e.message || 'Staged reset failed. The transaction was rolled back.' });
    }
  });
  app.get('/api/admin/year-archives', async (req, r) => {
    try {
      const c = await caller(req, r, ['GENERAL_SUPERINTENDENT']); if (!c) return;
      const { data, error } = await getSupabaseAdmin().rpc('gofamint_list_archive_metadata');
      if (error) throw error;
      r.json({ success: true, archives: data || [] });
    } catch (e: any) {
      console.error('[Server] archive metadata read failed:', e);
      r.status(500).json({ error: e.message || 'Could not list database archives.' });
    }
  });
  app.get('/api/admin/year-archives/:id/download', async (req, r) => {
    try {
      const c = await caller(req, r, ['GENERAL_SUPERINTENDENT']); if (!c) return;
      const archiveId = limitedText(req.params.id, 180);
      if (!archiveId) return r.status(400).json({ error: 'Archive id is required.' });
      const { data, error } = await getSupabaseAdmin().from('sunday_school_year_archives').select('id,data,archived_at').eq('id', archiveId).maybeSingle();
      if (error) throw error;
      if (!data) return r.status(404).json({ error: 'Archive not found.' });
      r.setHeader('Content-Type', 'application/json');
      r.setHeader('Content-Disposition', `attachment; filename="${archiveId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json"`);
      r.setHeader('Cache-Control', 'no-store');
      r.send(JSON.stringify({ format: 'GOFAMINT_ARCHIVE_V1', ...data }, null, 2));
    } catch (e: any) {
      console.error('[Server] archive download failed:', e);
      r.status(500).json({ error: e.message || 'Could not download database archive.' });
    }
  });
  app.post('/api/admin/factory-reset', async (req, r) => {
    try {
      const c = await caller(req, r, ['GENERAL_SUPERINTENDENT']); if (!c) return;
      if (process.env.FACTORY_RESET_ENABLED !== 'true') return r.status(503).json({ error: 'Factory reset is disabled by server configuration.' });
      if (req.body?.confirmPhrase !== 'FACTORY RESET GOFAMINT') return r.status(400).json({ error: 'Exact factory reset confirmation is required.' });
      const { data, error } = await getSupabaseAdmin().rpc('gofamint_staged_reset', { p_scope: 'FULL', p_actor_id: c.id });
      if (error) throw error;
      return r.json({ success: true, ...data, message: 'The active database was archived and returned to first-time initialization state.' });
    } catch (e: any) { r.status(500).json({ error: e.message || 'Factory reset request failed.' }); }
  });
  app.post('/api/admin/classes/mass-create', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, CLASS_CREATORS);
      if (!c) return;
      const { classes: customClasses } = req.body || {};
      if (!Array.isArray(customClasses) || customClasses.length === 0) {
        return r.status(400).json({ error: 'Provide at least one class with a unique ID and temporary password.' });
      }
      if (customClasses.length > 50) {
        return r.status(400).json({ error: 'A maximum of 50 classes can be created in one request.' });
      }
      const currentYear = new Date().getFullYear();
      const now = new Date().toISOString();
      const resultClasses: any[] = [];

      for (const item of customClasses) {
        const cleanDept = limitedText(item?.department || 'Adult', 120);
        const className = limitedText(item?.className, 160);
        const classId = limitedText(item?.classId || className.toUpperCase().replace(/[^A-Z0-9]/g, '_'), 120)
          .toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const password = String(item?.password || '');
        if (!cleanDept || !className || !classId) {
          return r.status(400).json({ error: 'Every class requires a department, name, and unique ID.' });
        }
        if (password.length < 6) {
          return r.status(400).json({ error: `Class ${classId} requires a temporary password of at least 6 characters.` });
        }

        const { error: departmentError } = await db.from('departments')
          .upsert({ id: cleanDept, name: cleanDept, data: {} }, { onConflict: 'id' });
        if (departmentError) throw departmentError;

        const { data: existing, error: existingError } = await db.from('classes')
          .select('id, department_id, data').eq('id', classId).maybeSingle();
        if (existingError) throw existingError;

        const classData: Record<string, any> = existing
          ? {
              ...(existing.data && typeof existing.data === 'object' ? existing.data : {}),
              id: existing.id,
              className: existing.data?.className || className,
              department: existing.data?.department || cleanDept,
              updatedAt: now,
            }
          : {
              id: classId,
              className,
              department: cleanDept,
              secretaryName: '',
              secretaryPhone: '',
              teachers: [],
              quarterTitle: 'Quarter 1: Sunday School Curriculum',
              year: currentYear,
              currencySymbol: '₦',
              isSetupComplete: false,
              approvalStatus: 'PENDING_REGISTRATION',
              createdAt: now,
              updatedAt: now,
            };
        // Login secrets belong only in Supabase Auth, never in a readable class row.
        delete classData.password;

        let insertedClass = false;
        if (existing) {
          const { error: sanitizeError } = await db.from('classes').update({
            department_id: cleanDept,
            data: classData,
            updated_at: now,
          }).eq('id', classId);
          if (sanitizeError) throw sanitizeError;
        } else {
          const { error: insertError } = await db.from('classes').insert({
            id: classId,
            department_id: cleanDept,
            data: classData,
            created_at: now,
            updated_at: now,
          });
          if (insertError) throw insertError;
          insertedClass = true;
        }

        try {
          const loginEmail = normalizeClassLoginIdentifier(classId);
          const { data: existingLogin, error: loginLookupError } = await db.from('profiles')
            .select('id,role,class_id,is_approved').eq('email', loginEmail).maybeSingle();
          if (loginLookupError) throw loginLookupError;

          let loginUserId = existingLogin?.id;
          if (existingLogin) {
            if (!CLASS_PORTAL_ROLES.includes(existingLogin.role as GofamintRole) || (existingLogin.class_id && existingLogin.class_id !== classId)) {
              throw new Error(`Login identifier ${classId} is already assigned to another account.`);
            }
            const { error: passwordUpdateError } = await db.auth.admin.updateUserById(existingLogin.id, { password });
            if (passwordUpdateError) throw passwordUpdateError;
            const { error: profileUpdateError } = await db.from('profiles').update({
              class_id: classId,
              is_approved: true,
              approved_by: c.id,
              approved_at: existingLogin.is_approved ? undefined : now,
              updated_at: now,
            }).eq('id', existingLogin.id);
            if (profileUpdateError) throw profileUpdateError;
          } else {
            const provisioned = await provisionSupabaseUserProfile({
              email: loginEmail,
              password,
              displayName: `${className} Teacher / Secretary`,
              role: 'TEACHER / CLASS_SECRETARY',
              isApproved: true,
              classId,
              createdBy: c.id,
              approvedBy: c.id,
            });
            loginUserId = provisioned.userId;
          }

          const { error: assignmentError } = await db.from('profile_class_assignments')
            .upsert({ profile_id: loginUserId, class_id: classId });
          if (assignmentError) {
            if (!existingLogin && loginUserId) await db.auth.admin.deleteUser(loginUserId);
            throw assignmentError;
          }
        } catch (loginError) {
          if (insertedClass) await db.from('classes').delete().eq('id', classId);
          throw loginError;
        }

        resultClasses.push(classData);
      }

      await audit(c, 'CREATE_CLASSES', { count: resultClasses.length }, 'classes');
      r.json({ success: true, classes: resultClasses });
    } catch (e: any) {
      console.error('[Server] create classes error:', e);
      r.status(500).json({ error: e.message || 'Failed to create classes.' });
    }
  });
  app.post('/api/classes/:classId/submit-registration', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r);
      if (!c) return;
      const classId = limitedText(req.params.classId, 120);
      if (!CLASS_PORTAL_ROLES.includes(c.role) || !c.classId || canonicalClassId(c.classId) !== canonicalClassId(classId)) {
        return r.status(403).json({ error: 'This class login is not assigned to the requested class.' });
      }

      const secretaryWorkerId = limitedText(req.body?.secretaryWorkerId, 120);
      const teacherWorkerIds = Array.from(new Set(
        (Array.isArray(req.body?.teacherWorkerIds) ? req.body.teacherWorkerIds : [])
          .map((id: unknown) => limitedText(id, 120))
          .filter(Boolean)
      )) as string[];
      if (!secretaryWorkerId || teacherWorkerIds.length === 0) {
        return r.status(400).json({ error: 'Select one registered worker as secretary and at least one registered worker as teacher.' });
      }
      if (teacherWorkerIds.length > 10) {
        return r.status(400).json({ error: 'A class registration may contain at most 10 teachers.' });
      }

      const { data: existingClass, error: classError } = await db.from('classes')
        .select('id,department_id,data').eq('id', classId).maybeSingle();
      if (classError) throw classError;
      if (!existingClass) return r.status(404).json({ error: `Class ${classId} does not exist.` });
      if (existingClass.data?.approvalStatus === 'APPROVED') {
        return r.status(409).json({ error: 'This class is already approved. Registration cannot overwrite its approval.' });
      }

      const requiredWorkerIds = Array.from(new Set([secretaryWorkerId, ...teacherWorkerIds]));
      const { data: workerRows, error: workerError } = await db.from('workers').select('id,data').in('id', requiredWorkerIds);
      if (workerError) throw workerError;
      const workerById = new Map((workerRows || []).map(worker => [worker.id, worker]));
      const missingWorkerIds = requiredWorkerIds.filter(workerId => !workerById.has(workerId));
      if (missingWorkerIds.length > 0) {
        return r.status(400).json({ error: `Selected worker record(s) were not found: ${missingWorkerIds.join(', ')}` });
      }

      const secretary = workerById.get(secretaryWorkerId)!;
      const secretaryName = limitedText(secretary.data?.fullName, 160);
      if (!secretaryName) throw new Error(`Worker ${secretaryWorkerId} has no valid full name.`);
      const teachers = teacherWorkerIds.map((workerId, index) => {
        const worker = workerById.get(workerId)!;
        const name = limitedText(worker.data?.fullName, 160);
        if (!name) throw new Error(`Worker ${workerId} has no valid full name.`);
        return {
          id: worker.id,
          name,
          phone: limitedText(worker.data?.phone, 60),
          isHeadTeacher: index === 0,
        };
      });

      const now = new Date().toISOString();
      const classData: Record<string, any> = {
        ...(existingClass.data && typeof existingClass.data === 'object' ? existingClass.data : {}),
        id: existingClass.id,
        department: existingClass.data?.department || existingClass.department_id || 'Adult',
        secretaryName,
        secretaryPhone: limitedText(secretary.data?.phone, 60),
        teachers,
        isSetupComplete: true,
        approvalStatus: 'PENDING_APPROVAL',
        updatedAt: now,
      };
      delete classData.password;

      const { data: updatedClass, error: updateError } = await db.from('classes').update({
        data: classData,
        updated_at: now,
      }).eq('id', classId).select('id,department_id,data,updated_at').maybeSingle();
      if (updateError) throw updateError;
      if (!updatedClass) throw new Error('The class registration update did not modify a database row.');

      await audit(c, 'SUBMIT_CLASS_REGISTRATION', {
        classId,
        secretaryWorkerId,
        teacherWorkerIds,
      }, 'classes', classId);
      return r.json({ success: true, class: { ...classData, id: updatedClass.id, department: classData.department } });
    } catch (e: any) {
      console.error('[Server] submit class registration error:', e);
      return r.status(500).json({ error: e.message || 'Failed to submit class registration.' });
    }
  });
  app.post('/api/admin/classes/approve', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, APPROVERS);
      if (!c) return;
      const { classId, classData } = req.body || {};
      if (!classId) return r.status(400).json({ error: 'Class ID is required.' });

      const { data: existing, error: fetchError } = await db.from('classes').select('*').eq('id', classId).maybeSingle();
      if (fetchError) throw fetchError;

      const mergedData = {
        ...(existing?.data && typeof existing.data === 'object' ? existing.data : {}),
        ...(classData && typeof classData === 'object' ? classData : {}),
      };

      const dept = String(mergedData.department || existing?.department_id || 'Adult').trim();
      const now = new Date().toISOString();

      if (dept) {
        const { error: departmentError } = await db.from('departments').upsert(
          { id: dept, name: dept, data: {} },
          { onConflict: 'id', ignoreDuplicates: true }
        );
        if (departmentError) throw new Error(`Could not verify department "${dept}": ${departmentError.message}`);
      }

      const updatedClassData = {
        ...mergedData,
        id: classId,
        department: dept,
        approvalStatus: 'APPROVED',
        approvedBy: c.email || c.role,
        approvedAt: now,
        updatedAt: now
      };

      console.log('[Server] APPROVE ENDPOINT: classId =', classId, 'caller =', c.email);
      console.log('[Server] Existing class row found:', !!existing, 'existing data approvalStatus:', existing?.data?.approvalStatus);

      if (existing) {
        const { data: upData, error: updateError } = await db.from('classes').update({
          department_id: dept,
          data: updatedClassData,
          updated_at: now
        }).eq('id', classId).select();
        console.log('[Server] Update query returned rows count:', upData?.length, 'error:', updateError);
        if (upData && upData.length > 0) {
          console.log('[Server] Updated row in Supabase: approvalStatus =', upData[0]?.data?.approvalStatus);
        }
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await db.from('classes').insert({
          id: classId,
          department_id: dept,
          data: updatedClassData,
          created_at: now,
          updated_at: now
        });
        if (insertError) throw insertError;
      }

      // Copy active quarter lessons to lessons table if available (batch upsert)
      try {
        const { data: config } = await db.from('system_config').select('data').eq('id', 'initialization').maybeSingle();
        const currentYearId = config?.data?.currentYearId;
        if (currentYearId) {
          const { data: yearRow } = await db.from('sunday_school_years').select('data').eq('id', currentYearId).maybeSingle();
          const yearData = yearRow?.data;
          const activeQ = yearData?.quarters?.find((q: any) => q.quarterNumber === yearData?.activeQuarterNumber);
          if (activeQ?.lessons && Array.isArray(activeQ.lessons) && activeQ.lessons.length > 0) {
            const lessonRows = activeQ.lessons.map((l: any) => ({
              id: `${currentYearId}_W${l.weekNumber}`,
              year_id: currentYearId,
              week_number: l.weekNumber,
              data: l,
              updated_at: now
            }));
            await db.from('lessons').upsert(lessonRows, { onConflict: 'id' });
          }
        }
      } catch (lessonErr) {
        console.warn('[Server] Note: Lesson copy during class approval skipped:', lessonErr);
      }

      try {
        await audit(c, 'APPROVE_CLASS', { classId, className: updatedClassData.className || classId }, 'classes', classId);
      } catch (auditErr) {
        console.warn('[Server] Audit log failed for approve class:', auditErr);
      }

      r.json({
        success: true,
        message: `Class "${updatedClassData.className || classId}" approved and activated successfully.`,
        class: {
          ...updatedClassData,
          department_id: dept,
          updatedAt: now
        }
      });
    } catch (e: any) {
      console.error('[Server] Approve class error:', e);
      r.status(500).json({ error: e.message || 'Failed to approve class.' });
    }
  });
  app.get('/api/admin/classes', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r);
      if (!c) return;
      let query = db.from('classes').select('*').order('id');
      if (CLASS_PORTAL_ROLES.includes(c.role)) {
        if (!c.classId) return r.json({ success: true, classes: [] });
        query = query.eq('id', c.classId);
      } else if (c.role === 'DEPARTMENT_SUPERINTENDENT') {
        if (!c.departmentId) return r.json({ success: true, classes: [] });
        query = query.eq('department_id', c.departmentId);
      }
      const { data, error } = await query;
      if (error) throw error;
      const classes = (data || []).map((row: any) => ({
        ...(row.data && typeof row.data === 'object' ? row.data : {}),
        id: row.id,
        department: row.data?.department || row.department_id || 'Adult',
        approvalStatus: row.data?.approvalStatus || 'PENDING_REGISTRATION',
        approvedBy: row.data?.approvedBy || undefined,
        approvedAt: row.data?.approvedAt || undefined,
        createdAt: row.created_at || row.data?.createdAt,
        updatedAt: row.updated_at || row.data?.updatedAt
      }));
      r.json({ success: true, classes });
    } catch (e: any) {
      console.error('[Server] get classes error:', e);
      r.status(500).json({ error: e.message || 'Failed to get classes.' });
    }
  });
  app.delete('/api/admin/classes/:id', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, CLASS_ADMINS);
      if (!c) return;
      const classId = req.params.id;
      if (!classId) return r.status(400).json({ error: 'Class ID is required.' });
      const { error } = await db.from('classes').delete().eq('id', classId);
      if (error) throw error;
      await audit(c, 'DELETE_CLASS', { classId }, 'classes', classId);
      r.json({ success: true, message: `Class ${classId} deleted successfully.` });
    } catch (e: any) {
      console.error('[Server] delete class error:', e);
      r.status(500).json({ error: e.message || 'Failed to delete class.' });
    }
  });
  app.delete('/api/admin/workers/:id', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY']);
      if (!c) return;
      const workerId = req.params.id;
      if (!workerId) return r.status(400).json({ error: 'Worker ID is required.' });
      const { error } = await db.from('workers').delete().eq('id', workerId);
      if (error) throw error;
      await audit(c, 'DELETE_WORKER', { workerId }, 'workers', workerId);
      r.json({ success: true, message: `Worker ${workerId} deleted successfully.` });
    } catch (e: any) {
      console.error('[Server] delete worker error:', e);
      r.status(500).json({ error: e.message || 'Failed to delete worker.' });
    }
  });
  app.get('/api/workers/directory', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, Array.from(WORKER_DIRECTORY_READERS));
      if (!c) return;
      const { data, error } = await db.from('workers').select('*').order('created_at');
      if (error) throw error;
      const workers = (data || []).map((row: any) => ({
        ...(row.data && typeof row.data === 'object' ? row.data : {}),
        id: row.id,
        fullName: row.data?.fullName || row.data?.name || row.id,
        department: row.data?.department || 'General',
        designation: row.data?.designation || 'Worker',
        phone: row.data?.phone || '',
        createdAt: row.created_at || row.data?.createdAt,
        updatedAt: row.updated_at || row.data?.updatedAt
      }));
      r.json({ success: true, workers });
    } catch (e: any) {
      console.error('[Server] get workers directory error:', e);
      r.status(500).json({ error: e.message || 'Failed to get workers directory.' });
    }
  });
  app.get('/api/admin/special-events', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, Array.from(WORKER_EVENT_READERS));
      if (!c) return;
      const [evtsRes, attRes] = await Promise.all([
        db.from('special_events').select('*').order('created_at', { ascending: false }),
        db.from('special_event_attendance').select('*').order('created_at', { ascending: false })
      ]);
      if (evtsRes.error) throw evtsRes.error;
      if (attRes.error) throw attRes.error;

      const events = (evtsRes.data || []).map((row: any) => ({
        ...(row.data && typeof row.data === 'object' ? row.data : {}),
        id: row.id,
        createdAt: row.created_at || row.data?.createdAt,
        updatedAt: row.updated_at || row.data?.updatedAt
      }));

      const attendance = (attRes.data || []).map((row: any) => ({
        ...(row.data && typeof row.data === 'object' ? row.data : {}),
        id: row.id,
        eventId: row.event_id || row.data?.eventId,
        workerId: row.worker_id || row.data?.workerId,
        createdAt: row.created_at || row.data?.createdAt,
        updatedAt: row.updated_at || row.data?.updatedAt
      }));

      r.json({ success: true, events, attendance });
    } catch (e: any) {
      console.error('[Server] get special events error:', e);
      r.status(500).json({ error: e.message || 'Failed to get special events.' });
    }
  });

  app.post('/api/admin/special-events', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, Array.from(WORKER_MANAGERS));
      if (!c) return;
      const { event } = req.body || {};
      if (!event || !event.id || !event.name) {
        return r.status(400).json({ error: 'Valid event data with id and name is required.' });
      }
      const now = new Date().toISOString();
      const eventData = {
        ...event,
        updatedAt: now,
        createdAt: event.createdAt || now
      };
      const cleanData = { ...eventData };
      delete cleanData.id;

      const { error } = await db.from('special_events').upsert({
        id: event.id,
        data: cleanData,
        updated_at: now
      }, { onConflict: 'id' });
      if (error) throw error;

      await audit(c, 'SAVE_SPECIAL_EVENT', { eventId: event.id, name: event.name }, 'special_events', event.id);
      r.json({ success: true, event: eventData });
    } catch (e: any) {
      console.error('[Server] save special event error:', e);
      r.status(500).json({ error: e.message || 'Failed to save special event.' });
    }
  });

  app.delete('/api/admin/special-events/:id', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, Array.from(WORKER_MANAGERS));
      if (!c) return;
      const eventId = req.params.id;
      if (!eventId) return r.status(400).json({ error: 'Event ID is required.' });

      // The attendance foreign key is ON DELETE CASCADE, so this single
      // statement removes the event and its attendance atomically.
      const { data: deleted, error } = await db.from('special_events').delete().eq('id', eventId).select('id');
      if (error) throw error;
      if (!deleted?.length) return r.status(404).json({ error: 'Special event was not found or was already deleted.' });

      await audit(c, 'DELETE_SPECIAL_EVENT', { eventId }, 'special_events', eventId);
      r.json({ success: true, message: `Event ${eventId} deleted successfully.` });
    } catch (e: any) {
      console.error('[Server] delete special event error:', e);
      r.status(500).json({ error: e.message || 'Failed to delete special event.' });
    }
  });

  app.post('/api/admin/special-events/attendance', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, Array.from(WORKER_MANAGERS));
      if (!c) return;
      const { records } = req.body || {};
      const list = Array.isArray(records) ? records : (req.body?.record ? [req.body.record] : []);
      if (list.length === 0) return r.status(400).json({ error: 'At least one record is required.' });

      const now = new Date().toISOString();
      const rows = list.map((item: any) => {
        const itemCopy = { ...item, updatedAt: now };
        delete itemCopy.id;
        return {
          id: item.id,
          event_id: item.eventId,
          worker_id: item.workerId,
          data: itemCopy,
          created_at: item.createdAt || now
        };
      });

      const { error } = await db.from('special_event_attendance').upsert(rows, { onConflict: 'id' });
      if (error) throw error;

      r.json({ success: true, count: rows.length });
    } catch (e: any) {
      console.error('[Server] save special event attendance error:', e);
      r.status(500).json({ error: e.message || 'Failed to save special event attendance.' });
    }
  });

  app.get('/api/admin/workers/prep-attendance', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, Array.from(WORKER_EVENT_READERS));
      if (!c) return;
      const { data, error } = await db.from('worker_prep_attendance').select('*').order('updated_at', { ascending: false });
      if (error) throw error;

      const records = (data || []).map((row: any) => ({
        ...(row.data && typeof row.data === 'object' ? row.data : {}),
        id: row.id,
        workerId: row.worker_id || row.data?.workerId,
        prepDate: row.prep_date || row.data?.prepDate,
        updatedAt: row.updated_at || row.data?.updatedAt
      }));

      r.json({ success: true, records });
    } catch (e: any) {
      console.error('[Server] get worker prep attendance error:', e);
      r.status(500).json({ error: e.message || 'Failed to get worker prep attendance.' });
    }
  });

  app.post('/api/admin/workers/prep-attendance', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, Array.from(WORKER_MANAGERS));
      if (!c) return;
      const { records } = req.body || {};
      const list = Array.isArray(records) ? records : (req.body?.record ? [req.body.record] : []);
      if (list.length === 0) return r.status(400).json({ error: 'At least one record is required.' });

      const now = new Date().toISOString();
      const rows = list.map((item: any) => {
        const itemCopy = { ...item, updatedAt: now };
        delete itemCopy.id;
        return {
          id: item.id,
          worker_id: item.workerId,
          prep_date: item.prepDate,
          data: itemCopy,
          updated_at: item.updatedAt || now
        };
      });

      const { error } = await db.from('worker_prep_attendance').upsert(rows, { onConflict: 'id' });
      if (error) throw error;

      r.json({ success: true, count: rows.length });
    } catch (e: any) {
      console.error('[Server] save worker prep attendance error:', e);
      r.status(500).json({ error: e.message || 'Failed to save worker prep attendance.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    app.get('/api/schema',(_q,r)=>{const file=path.join(process.cwd(),'src','db','schema.sql');return fs.existsSync(file)?r.type('text/plain').send(fs.readFileSync(file,'utf8')):r.status(404).send('Schema file not found.');});
  }
  app.delete('/api/admin/special-events/attendance/:id', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, Array.from(WORKER_MANAGERS));
      if (!c) return;
      const recordId = limitedText(req.params.id, 200);
      if (!recordId) return r.status(400).json({ error: 'Attendance record ID is required.' });
      const { data: deleted, error } = await db.from('special_event_attendance').delete().eq('id', recordId).select('id');
      if (error) throw error;
      if (!deleted?.length) return r.status(404).json({ error: 'Attendance record was not found or was already deleted.' });
      await audit(c, 'DELETE_SPECIAL_EVENT_ATTENDANCE', { recordId }, 'special_event_attendance', recordId);
      r.json({ success: true, message: 'Special-event attendance removed.' });
    } catch (e: any) {
      console.error('[Server] delete special event attendance error:', e);
      r.status(500).json({ error: e.message || 'Failed to delete special-event attendance.' });
    }
  });
  app.use('/api', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });
  app.use((error: any, _req: Request, res: Response, _next: express.NextFunction) => {
    const isInvalidJson = error instanceof SyntaxError && 'body' in error;
    console.error('[Server] Request handling error:', error?.message || error);
    res.status(isInvalidJson ? 400 : 500).json({
      error: isInvalidJson ? 'Request body must be valid JSON.' : 'Unexpected server error.',
    });
  });
  return app;
}
