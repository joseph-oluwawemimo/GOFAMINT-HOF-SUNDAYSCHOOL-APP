import express, { type Request, type Response } from 'express';
import path from 'path';
import fs from 'fs';
import { GOFAMINT_ROLES, getBearerToken, getSupabaseAdmin, provisionSupabaseUserProfile, type GofamintRole } from './supabaseAdmin.js';

const EXEC: GofamintRole[] = ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY'];
const APPROVERS: GofamintRole[] = ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY'];
const ADMIN_PROFILES = new Set<GofamintRole>([...EXEC, 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY', 'TREASURER', 'RECORD_OFFICER', 'ENROLLMENT_OFFICER']);
const CLASS_ADMINS: GofamintRole[] = ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY'];
type Caller = { id: string; email: string | null; role: GofamintRole };

async function caller(req: Request, res: Response, allowed?: GofamintRole[]): Promise<Caller | null> {
  const token = getBearerToken(req.headers.authorization);
  if (!token) { res.status(401).json({ error: 'Missing sign-in token.' }); return null; }
  const db = getSupabaseAdmin();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) { res.status(401).json({ error: 'Invalid or expired sign-in token.' }); return null; }
  const { data: p, error } = await db.from('profiles').select('id,email,role,is_approved').eq('id', auth.user.id).maybeSingle();
  if (error || !p || !p.is_approved || !GOFAMINT_ROLES.includes(p.role as GofamintRole)) { res.status(403).json({ error: 'An approved application profile is required.' }); return null; }
  const result = { id: p.id, email: p.email || auth.user.email || null, role: p.role as GofamintRole };
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

export function createApp() {
  const app = express(); app.use(express.json({ limit: '50mb' }));
  app.get('/api/health', (_q, r) => r.json({ status: 'ok', provider: 'supabase' }));
  app.get('/api/system/status', async (_q, r) => {
    try { const { data, error } = await getSupabaseAdmin().from('system_config').select('initialized,schema_version').eq('id','initialization').maybeSingle(); if (error) throw error; r.json({ initialized: data?.initialized === true, schemaVersion: data?.schema_version || 0 }); }
    catch (e:any) { r.status(500).json({ error: e.message || 'Could not read system status.' }); }
  });
  app.post('/api/admin/bootstrap', async (req, r) => {
    const db = getSupabaseAdmin(); let userId: string | null = null; let bootstrapLockClaimed = false;
    try {
      const { data: state, error } = await db.from('system_config').select('initialized').eq('id','initialization').maybeSingle(); if (error) throw error;
      if (state?.initialized) return r.status(409).json({ error: 'System has already been initialized.' });
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
    } catch (e:any) { if (userId) await db.auth.admin.deleteUser(userId).catch(()=>{}); if (bootstrapLockClaimed) await db.from('system_config').delete().eq('id', 'bootstrap_lock'); r.status(500).json({ error:e.message || 'Bootstrap failed.' }); }
  });
  app.get('/api/admin/list-users', async (req,r) => {
    try { const c=await caller(req,r,EXEC); if(!c)return; const {data,error}=await getSupabaseAdmin().from('profiles').select('id,email,display_name,role,class_id,worker_id,is_approved,created_at,approved_by,approved_at').order('created_at'); if(error)throw error; r.json({success:true,users:(data||[]).map(p=>({uid:p.id,email:p.email,displayName:p.display_name,roleType:p.role,classId:p.class_id,workerId:p.worker_id,isApproved:p.is_approved,createdAt:p.created_at,approvedBy:p.approved_by,approvedAt:p.approved_at}))}); } catch(e:any){r.status(500).json({error:e.message||'Failed to list users.'});}
  });
  app.post('/api/admin/create-user', async (req,r) => {
    const db=getSupabaseAdmin(); let userId:string|null=null;
    try { const c=await caller(req,r,EXEC); if(!c)return; const {email:raw,password,roleType,displayName,classId,workerId}=req.body||{};
      if(!raw||!password||password.length<6||!GOFAMINT_ROLES.includes(roleType)) return r.status(400).json({error:'Valid email/login ID, password (minimum 6 characters), and roleType are required.'});
      if (['TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY'].includes(roleType) && !classId) return r.status(400).json({ error: 'A class assignment is required for teacher and class secretary accounts.' });
      const { count: superintendentCount, error: superintendentCountError } = await db.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'GENERAL_SUPERINTENDENT');
      if (superintendentCountError) throw superintendentCountError;
      // Both executive roles may provision ordinary staff.  Bootstrap roles
      // remain protected: a secretary cannot replace the superintendent or
      // create a peer secretary account.
      if (c.role === 'GENERAL_SECRETARY' && ['GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'SUPER_ADMIN'].includes(roleType)) {
        return r.status(403).json({ error: 'General Secretaries may create non-bootstrap staff accounts only.' });
      }
      if(roleType==='GENERAL_SUPERINTENDENT' && superintendentCount)return r.status(409).json({error:'A General Superintendent account already exists.'});
      const pending=['ASST_GENERAL_SECRETARY','ASSISTANT_GENERAL_SECRETARY','TREASURER','RECORD_OFFICER','ENROLLMENT_OFFICER'].includes(roleType);
      const provisioned=await provisionSupabaseUserProfile({email:email(raw),password,displayName,role:roleType,isApproved:!pending,classId:classId||null,workerId:workerId||null,createdBy:c.id,approvedBy:pending?null:c.id});userId=provisioned.userId;
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
      if(ADMIN_PROFILES.has(roleType)){const {error}=await db.from('admin_profiles').insert({id:userId,profile_id:userId,role_type:roleType,title:`${roleType.replace(/_/g,' ')} ID`,profile_name:displayName||email(raw),username:email(raw),is_approved:!pending,approved_by:!pending?c.id:null,approved_at:provisioned.approvedAt});if(error)throw error;}
      await audit(c,'CREATE_STAFF_LOGIN',{targetUserId:userId,targetEmail:email(raw),targetRole:roleType,isApproved:!pending},'profiles',userId);
      r.json({success:true,uid:userId,roleType,isApproved:!pending,message:pending?'Login created pending approval.':'Login created and active.'});
    }catch(e:any){if(userId)await db.auth.admin.deleteUser(userId).catch(()=>{});r.status(500).json({error:e.message||'Failed to create user.'});}
  });
  app.post('/api/admin/approve-user', async (req, r) => {
    try {
      const c = await caller(req, r, APPROVERS);
      if (!c) return;
      const id = req.body?.targetUid;
      const emailVal = req.body?.email ? String(req.body.email).trim().toLowerCase() : undefined;
      const roleType = req.body?.roleType ? String(req.body.roleType).trim() : undefined;
      if (!id && !emailVal && !roleType) return r.status(400).json({ error: 'targetUid, email, or roleType is required.' });
      const now = new Date().toISOString();
      const db = getSupabaseAdmin();

      // 1. Update profiles table (admin credentials have service role bypass)
      if (id) {
        await db.from('profiles').update({ is_approved: true, approved_by: c.id, approved_at: now, updated_at: now }).eq('id', id);
      }
      if (emailVal) {
        await db.from('profiles').update({ is_approved: true, approved_by: c.id, approved_at: now, updated_at: now }).eq('email', emailVal);
      }
      if (roleType) {
        await db.from('profiles').update({ is_approved: true, approved_by: c.id, approved_at: now, updated_at: now }).eq('role', roleType);
      }

      // 2. Update admin_profiles table
      if (id) {
        await db.from('admin_profiles').update({ is_approved: true, approved_by: c.id, approved_at: now, updated_at: now }).or(`id.eq.${id},profile_id.eq.${id}`);
      }
      if (emailVal) {
        await db.from('admin_profiles').update({ is_approved: true, approved_by: c.id, approved_at: now, updated_at: now }).eq('username', emailVal);
      }
      if (roleType) {
        await db.from('admin_profiles').update({ is_approved: true, approved_by: c.id, approved_at: now, updated_at: now }).eq('role_type', roleType);
      }

      await audit(c, 'APPROVE_STAFF_LOGIN', { targetUserId: id, email: emailVal, roleType }, 'profiles', id || emailVal || roleType || 'staff').catch(() => {});
      r.json({ success: true, message: 'Officer profile approved and activated.' });
    } catch (e: any) {
      console.error('[Server] Approve user error:', e);
      r.status(500).json({ error: e.message || 'Failed to approve user.' });
    }
  });
  app.post('/api/admin/delete-user',async(req,r)=>{try{const c=await caller(req,r,EXEC);if(!c)return;const id=req.body?.targetUid;if(!id||id===c.id)return r.status(400).json({error:'A different targetUid is required.'});const db=getSupabaseAdmin();const {data:t,error}=await db.from('profiles').select('email,role').eq('id',id).maybeSingle();if(error||!t)return r.status(404).json({error:'Target user identity not found.'});if(c.role==='GENERAL_SECRETARY'&&['GENERAL_SUPERINTENDENT','GENERAL_SECRETARY'].includes(t.role))return r.status(403).json({error:'Only the General Superintendent can delete executive officer identities.'});const x=await db.auth.admin.deleteUser(id);if(x.error)throw x.error;await audit(c,'DELETE_STAFF_IDENTITY',{targetUserId:id,targetEmail:t.email,targetRole:t.role},'profiles',id);r.json({success:true,message:'Staff login deleted; organizational data was preserved.'});}catch(e:any){r.status(500).json({error:e.message||'Failed to delete user.'});}});
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
      const data = resetData as { new_year_id?: string } | null;
      await audit(c, 'YEAR_RESET', { previousYearId: confirmYearId, newYearId: data?.new_year_id, newYearName }, 'sunday_school_years', data?.new_year_id);
      r.json({ success: true, newYearId: data?.new_year_id, newYearName, classesReassigned: 0, workersReassigned: 0 });
    } catch (e: any) { r.status(500).json({ error: e.message || 'Year reset failed.' }); }
  });
  app.post('/api/admin/factory-reset', async (req, r) => {
    try {
      const c = await caller(req, r, ['SUPER_ADMIN', 'GENERAL_SUPERINTENDENT']); if (!c) return;
      if (process.env.FACTORY_RESET_ENABLED !== 'true') return r.status(503).json({ error: 'Factory reset is disabled by server configuration.' });
      if (req.body?.confirmPhrase !== 'FACTORY RESET GOFAMINT') return r.status(400).json({ error: 'Exact factory reset confirmation is required.' });
      await audit(c, 'FACTORY_RESET_REQUESTED', { confirmation: 'accepted' }, 'system_config', 'initialization');
      return r.status(501).json({ error: 'Factory reset requires a separately reviewed operational runbook and is not enabled by this deployment.' });
    } catch (e: any) { r.status(500).json({ error: e.message || 'Factory reset request failed.' }); }
  });
  app.post('/api/admin/classes/mass-create', async (req, r) => {
    const db = getSupabaseAdmin();
    try {
      const c = await caller(req, r, CLASS_ADMINS);
      if (!c) return;
      const { department, suffixes, classes: customClasses } = req.body || {};
      const currentYear = new Date().getFullYear();
      const now = new Date().toISOString();
      const resultClasses: any[] = [];

      if (Array.isArray(customClasses) && customClasses.length > 0) {
        for (const item of customClasses) {
          const cleanDept = String(item.department || 'Adult').trim();
          const className = String(item.className || '').trim();
          const classId = String(item.classId || className.toUpperCase().replace(/[^A-Z0-9]/g, '_')).trim();
          const password = String(item.password || '').trim();

          if (!className || !classId) continue;
          await db.from('departments').upsert({ id: cleanDept, name: cleanDept, data: {} }, { onConflict: 'id' });

          const { data: existing } = await db.from('classes').select('id, department_id, data').eq('id', classId).maybeSingle();
          if (existing) {
            resultClasses.push({
              ...(existing.data && typeof existing.data === 'object' ? existing.data : {}),
              id: existing.id,
              className: existing.data?.className || className,
              department: existing.data?.department || cleanDept,
            });
            continue;
          }

          const newClass = {
            id: classId,
            className,
            department: cleanDept,
            password: password || '123456',
            secretaryName: '',
            secretaryPhone: '',
            teachers: [],
            quarterTitle: 'Quarter 1: Sunday School Curriculum',
            year: currentYear,
            currencySymbol: '₦',
            isSetupComplete: false,
            approvalStatus: 'PENDING_REGISTRATION',
            createdAt: now,
            updatedAt: now
          };

          const { error: insertError } = await db.from('classes').insert({
            id: classId,
            department_id: cleanDept,
            data: newClass,
            created_at: now,
            updated_at: now
          });
          if (insertError) throw insertError;

          resultClasses.push(newClass);
        }
      } else {
        const cleanDept = String(department || 'Adult').trim();
        const rawSuffixes: string[] = Array.isArray(suffixes) && suffixes.length > 0 ? suffixes : ['A', 'B', 'C'];
        await db.from('departments').upsert({ id: cleanDept, name: cleanDept, data: {} }, { onConflict: 'id' });

        for (const suffix of rawSuffixes) {
          const cleanSuffix = String(suffix).trim().toUpperCase();
          if (!cleanSuffix) continue;
          const classId = `${cleanDept.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_${cleanSuffix}`;
          const className = `${cleanDept} Class ${cleanSuffix}`;

          const { data: existing } = await db.from('classes').select('id, department_id, data').eq('id', classId).maybeSingle();
          if (existing) {
            resultClasses.push({
              ...(existing.data && typeof existing.data === 'object' ? existing.data : {}),
              id: existing.id,
              className: existing.data?.className || className,
              department: existing.data?.department || cleanDept,
            });
            continue;
          }

          const newClass = {
            id: classId,
            className,
            department: cleanDept,
            password: 'password123',
            secretaryName: '',
            secretaryPhone: '',
            teachers: [],
            quarterTitle: 'Quarter 1: Sunday School Curriculum',
            year: currentYear,
            currencySymbol: '₦',
            isSetupComplete: false,
            approvalStatus: 'PENDING_REGISTRATION',
            createdAt: now,
            updatedAt: now
          };

          const { error: insertError } = await db.from('classes').insert({
            id: classId,
            department_id: cleanDept,
            data: newClass,
            created_at: now,
            updated_at: now
          });
          if (insertError) throw insertError;

          resultClasses.push(newClass);
        }
      }

      await audit(c, 'CREATE_CLASSES', { count: resultClasses.length }, 'classes');
      r.json({ success: true, classes: resultClasses });
    } catch (e: any) {
      console.error('[Server] create classes error:', e);
      r.status(500).json({ error: e.message || 'Failed to create classes.' });
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
        try { await db.from('departments').upsert({ id: dept, name: dept, data: {} }, { onConflict: 'id' }); } catch {}
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
      const c = await caller(req, r, Array.from(ADMIN_PROFILES));
      if (!c) return;
      const { data, error } = await db.from('classes').select('*').order('id');
      if (error) throw error;
      const classes = (data || []).map((row: any) => ({
        ...(row.data && typeof row.data === 'object' ? row.data : {}),
        id: row.id,
        department: row.data?.department || row.department_id || 'Adult',
        approvalStatus: row.data?.approvalStatus || 'APPROVED',
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
  app.get('/api/workers/directory', async (_req, r) => {
    const db = getSupabaseAdmin();
    try {
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
  app.get('/api/schema',(_q,r)=>{const file=path.join(process.cwd(),'src','db','schema.sql');return fs.existsSync(file)?r.type('text/plain').send(fs.readFileSync(file,'utf8')):r.status(404).send('Schema file not found.');});
  return app;
}
