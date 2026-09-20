import React, { useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { useModalBackHandler } from '../hooks/useModalBackHandler';
import {
  Users,
  UserPlus,
  Camera,
  Search,
  Phone,
  MapPin,
  Briefcase,
  HeartHandshake,
  ArrowRightLeft,
  Sparkles,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Clock,
  UserCheck,
  Share2,
  Link2,
  Copy,
  Check,
  X
} from 'lucide-react';
import {
  Member,
  MemberType,
  WeeklyGradeRecord,
  ClassProfile,
  VisitorQualification
} from '../types';
import { getConsecutiveVisits, checkVisitorQualification } from '../utils/calculations';
import { CameraModal } from './CameraModal';
import { BulkMemberImportModal } from './BulkMemberImportModal';

interface RosterManagementViewProps {
  members: Member[];
  grades: WeeklyGradeRecord[];
  currentWeek: number;
  classProfile: ClassProfile | null;
  quarterStatus?: 'ACTIVE' | 'ARCHIVED' | 'UPCOMING';
  selectedQuarter?: number;
  onSaveMember: (member: Member) => Promise<void> | void;
  onSaveBulkMembers?: (members: Member[]) => Promise<void> | void;
  onDeleteMember: (id: string) => void;
  onConvertVisitorToStudent: (memberId: string) => void;
  preSelectedSponsorId?: string | null;
  onClearPreSelectedSponsor?: () => void;
}

export const RosterManagementView: React.FC<RosterManagementViewProps> = ({
  members,
  grades,
  currentWeek,
  classProfile,
  quarterStatus = 'ACTIVE',
  selectedQuarter = 1,
  onSaveMember,
  onSaveBulkMembers,
  onDeleteMember,
  onConvertVisitorToStudent,
  preSelectedSponsorId,
  onClearPreSelectedSponsor
}) => {
  const isReadOnly = quarterStatus === 'ARCHIVED' || quarterStatus === 'UPCOMING';
  useScrollRestoration('roster_management');
  const [activeRosterTab, setActiveRosterTab] = usePersistedState<'ALL' | 'STUDENTS' | 'VISITORS'>('gofamint_roster_tab', 'ALL');
  const [searchTerm, setSearchTerm] = usePersistedState<string>('gofamint_roster_search', '');
  
  // Member Edit/Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(!!preSelectedSponsorId);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [targetType, setTargetType] = useState<MemberType>('VISITOR');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [occupation, setOccupation] = useState('');
  const [prayerRequests, setPrayerRequests] = useState('');
  const [notes, setNotes] = useState('');
  const [firstLessonWeek, setFirstLessonWeek] = useState(currentWeek);
  const [referredByMemberId, setReferredByMemberId] = useState(preSelectedSponsorId || '');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [saveMemberError, setSaveMemberError] = useState<string | null>(null);

  // Camera Modal
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // One-Time Visitor Profile Link Modal State
  const [activeLinkModalMember, setActiveLinkModalMember] = useState<Member | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const handleGenerateVisitorLink = async (member: Member) => {
    try {
      setIsGeneratingLink(true);
      const token = 'vis_' + Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const updatedMember: Member = {
        ...member,
        oneTimeProfileToken: {
          token,
          expiresAt,
          isUsed: false
        },
        updatedAt: new Date().toISOString()
      };

      await onSaveMember(updatedMember);
      setActiveLinkModalMember(updatedMember);
      setCopiedLink(false);
    } catch (err: any) {
      console.error('Failed to generate visitor link:', err);
      alert('Could not generate visitor link.');
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleRequestCloseModal = () => {
    const isDirty = Boolean(fullName.trim() || phone.trim() || address.trim() || prayerRequests.trim() || notes.trim());
    if (isDirty) {
      if (!window.confirm('You have unsaved changes in this member profile. Discard them?')) {
        return;
      }
    }
    setIsModalOpen(false);
    if (onClearPreSelectedSponsor) onClearPreSelectedSponsor();
  };

  useModalBackHandler(isModalOpen, handleRequestCloseModal, 'member-profile-modal');

  // Identify visitors with 2 or 3+ consecutive visits for automated progression prompts
  const visitorsWithConsecutive = members
    .filter(m => m.memberType === 'VISITOR' && m.status === 'ACTIVE')
    .map(v => ({
      visitor: v,
      consecutiveCount: getConsecutiveVisits(v.id, currentWeek, grades)
    }))
    .filter(item => item.consecutiveCount >= 3);

  const openAddModal = (_type: MemberType, sponsorId?: string) => {
    setEditingMember(null);
    setTargetType('VISITOR');
    setFullName('');
    setPhone('');
    setAddress('');
    setOccupation('');
    setPrayerRequests('');
    setNotes('');
    setFirstLessonWeek(currentWeek);
    setReferredByMemberId(sponsorId || '');
    setPhotoBase64(undefined);
    setIsModalOpen(true);
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setTargetType(member.memberType);
    setFullName(member.fullName);
    setPhone(member.phone);
    setAddress(member.address);
    setOccupation(member.occupation);
    setPrayerRequests(member.prayerRequests);
    setNotes(member.notes);
    setFirstLessonWeek(member.firstLessonWeek || 1);
    setReferredByMemberId(member.referredByMemberId || '');
    setPhotoBase64(member.photoBase64);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const memberToSave: Member = {
      id: editingMember ? editingMember.id : `mem_${Date.now()}`,
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      occupation: occupation.trim(),
      // Only the Enrollment Officer certification workflow may change status.
      memberType: editingMember ? editingMember.memberType : 'VISITOR',
      status: editingMember ? editingMember.status : 'ACTIVE',
      prayerRequests: prayerRequests.trim(),
      notes: notes.trim(),
      firstLessonWeek: Number(firstLessonWeek) || 1,
      referredByMemberId: referredByMemberId || undefined,
      evangelismReferralCount: editingMember ? editingMember.evangelismReferralCount : 0,
      photoBase64,
      createdAt: editingMember ? editingMember.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSavingMember(true);
    setSaveMemberError(null);
    try {
      await onSaveMember(memberToSave);
      setIsModalOpen(false);
      if (onClearPreSelectedSponsor) onClearPreSelectedSponsor();
    } catch (error) {
      console.error('Member profile save failed:', error);
      setSaveMemberError(error instanceof Error ? error.message : 'The member profile could not be saved. Please retry.');
    } finally {
      setIsSavingMember(false);
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesTab = 
      activeRosterTab === 'ALL' ||
      (activeRosterTab === 'STUDENTS' && m.memberType === 'STUDENT') ||
      (activeRosterTab === 'VISITORS' && m.memberType === 'VISITOR');

    const term = (searchTerm || '').toLowerCase();
    const matchesSearch = 
      (m.fullName || '').toLowerCase().includes(term) ||
      (m.phone || '').includes(searchTerm || '') ||
      (m.occupation || '').toLowerCase().includes(term) ||
      (m.prayerRequests || '').toLowerCase().includes(term);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Top Banner & Dynamic Creation Controls */}
      <div className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-lg p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-900 bg-blue-100 px-2 py-0.5 rounded">
              REGISTRATION SECTION
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
            Student Roster & Visitor Welcoming
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Every person begins as a Visitor. Once sufficient attendance is demonstrated (3 consecutive visits or 50% attendance), visitors qualify for promotion to full Student status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isReadOnly ? (
            <>
              <button
                id="btn-mass-import-members"
                onClick={() => setIsBulkImportOpen(true)}
                className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95"
                title="Import multiple members by pasting Name and Phone Number"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>📥 Mass Import (Name & Phone)</span>
              </button>

              <button
                id="btn-add-student"
                onClick={() => openAddModal('STUDENT')}
                className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Add Student</span>
              </button>

              <button
                id="btn-add-visitor"
                onClick={() => openAddModal('VISITOR')}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95"
              >
                <HeartHandshake className="w-4 h-4" />
                <span>+ Add Visitor</span>
              </button>
            </>
          ) : (
            <span className="px-3 py-1.5 rounded bg-slate-100 text-slate-500 text-xs font-bold border border-slate-200">
              🔒 Roster Locked in Read-Only Mode
            </span>
          )}
        </div>
      </div>

      {/* Automated Visitor Progression Logic Alert Section */}
      {visitorsWithConsecutive.length > 0 && (
        <div className="space-y-3">
          {visitorsWithConsecutive.map(({ visitor, consecutiveCount }) => (
            <div
              key={visitor.id}
              id={`visitor-progression-prompt-${visitor.id}`}
              className="bg-purple-50 border border-purple-200 border-l-4 border-l-purple-600 rounded-lg p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 border border-purple-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase bg-purple-200 text-purple-900 px-2 py-0.5 rounded">
                      Automated Visitor Progression
                    </span>
                    <span className="text-xs font-black text-purple-900">
                      {consecutiveCount} Consecutive Lessons Attended!
                    </span>
                  </div>

                  <p className="text-sm font-bold text-slate-900 mt-1">
                    {consecutiveCount === 2
                      ? `Visitor ${visitor.fullName} has attended 2 consecutive lessons. Convert to official Student Roster or wait 1 more lesson?`
                      : `Convert ${visitor.fullName} to full Student Roster now? (3+ consecutive lessons)`}
                  </p>

                  <p className="text-xs text-slate-600 mt-0.5">
                    Conversion seamlessly migrates all historic grading matrix records and prayer requests without re-keying data.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {visitor.conversionStatus === 'PENDING_APPROVAL' ? (
                  <div className="px-3.5 py-1.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                    <span>Awaiting Approval from Enrollment Officer</span>
                  </div>
                ) : !isReadOnly ? (
                  <button
                    id={`btn-convert-visitor-${visitor.id}`}
                    onClick={() => onConvertVisitorToStudent(visitor.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Request Promotion to Student</span>
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Roster Tab Switcher & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveRosterTab('ALL')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeRosterTab === 'ALL'
                ? 'bg-blue-900 text-white'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            All Members ({members.length})
          </button>
          <button
            onClick={() => setActiveRosterTab('STUDENTS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeRosterTab === 'STUDENTS'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Students ({members.filter(m => m.memberType === 'STUDENT').length})
          </button>
          <button
            onClick={() => setActiveRosterTab('VISITORS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              activeRosterTab === 'VISITORS'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
            }`}
          >
            Visitors ({members.filter(m => m.memberType === 'VISITOR').length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, phone, occupation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 font-medium"
          />
        </div>
      </div>

      {/* Members Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.length === 0 ? (
          <div className="col-span-full bg-white border border-slate-200 p-10 rounded-lg text-center text-slate-500 shadow-xs">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-400" />
            <p className="font-bold text-base text-slate-900">No members found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Add individual students or visitors, or use Mass Import to onboard your entire class list using just names and phone numbers.
            </p>
            {!isReadOnly && <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkImportOpen(true)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>📥 Mass Import Class (Name & Phone)</span>
              </button>
            </div>}
          </div>
        ) : (
          filteredMembers.map((member) => {
            const consecutiveVisits = member.memberType === 'VISITOR'
              ? getConsecutiveVisits(member.id, currentWeek, grades)
              : 0;

            return (
              <div
                key={member.id}
                id={`roster-card-${member.id}`}
                className={`bg-white border rounded-lg p-5 shadow-xs flex flex-col justify-between transition ${
                  member.memberType === 'STUDENT'
                    ? 'border-slate-200 border-l-4 border-l-blue-600'
                    : 'border-slate-200 border-l-4 border-l-purple-600'
                }`}
              >
                <div>
                  
                  {/* Top Avatar & Type Badge */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
                        {member.photoBase64 ? (
                          <img
                            src={member.photoBase64}
                            alt={member.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-lg font-black text-slate-700">
                            {member.fullName.charAt(0)}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-900 text-base">
                          {member.fullName}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            member.memberType === 'STUDENT'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {member.memberType}
                          </span>

                          {member.firstLessonWeek > 1 && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                              Joined Wk {member.firstLessonWeek}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isReadOnly && <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(member)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition"
                        title="Edit Profile"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteMember(member.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete Member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>}
                  </div>

                  {/* Profile Details List */}
                  <div className="space-y-1.5 text-xs text-slate-600 my-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800">{member.phone}</span>
                        <a
                          href={`https://wa.me/${member.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}

                    {member.occupation && (
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{member.occupation}</span>
                      </div>
                    )}

                    {member.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{member.address}</span>
                      </div>
                    )}

                    {member.evangelismReferralCount > 0 && (
                      <div className="flex items-center gap-2 text-amber-800 font-bold pt-1">
                        <HeartHandshake className="w-3.5 h-3.5 text-amber-600" />
                        <span>Evangelism: Brought {member.evangelismReferralCount} visitor(s)</span>
                      </div>
                    )}
                  </div>

                  {/* Prayer Requests */}
                  {member.prayerRequests && (
                    <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-xs mb-3">
                      <span className="text-[10px] font-bold uppercase text-blue-900 block mb-0.5">
                        Prayer Requests:
                      </span>
                      <p className="text-slate-700 italic text-[11px] line-clamp-2">
                        "{member.prayerRequests}"
                      </p>
                    </div>
                  )}

                </div>

                {/* Footer Controls (e.g. Visitor Convert Button) */}
                {member.memberType === 'VISITOR' && (() => {
                  const qual = checkVisitorQualification(member, grades, currentWeek);
                  return (
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-600">
                        {qual.isQualified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Qualified: {qual.description}</span>
                          </span>
                        ) : (
                          <span className="text-purple-700 font-semibold">
                            Visits: <strong>{qual.consecutiveVisits}</strong> consecutive | <strong>{qual.attendancePercentage}%</strong> rate
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleGenerateVisitorLink(member)}
                          disabled={isGeneratingLink || isReadOnly}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 cursor-pointer disabled:opacity-50"
                          title="Generate passwordless one-time link for visitor to complete their profile"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>One-Time Link</span>
                        </button>
                        {member.conversionStatus === 'PENDING_APPROVAL' ? (
                          <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 border border-amber-300 px-2 py-1 rounded text-xs">
                            <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>Awaiting Approval from Enrollment Officer</span>
                          </span>
                        ) : qual.isQualified && !isReadOnly ? (
                          <button
                            onClick={() => onConvertVisitorToStudent(member.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            title="Request promotion to official student"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Request Conversion to Student</span>
                          </button>
                        ) : isReadOnly ? (
                          <span className="text-[11px] font-semibold text-slate-500">Read-only oversight</span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500">Available after 3 consecutive attendances</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" onClick={handleRequestCloseModal}>
          <div className="bg-white border border-slate-200 rounded-lg max-w-lg w-full shadow-2xl overflow-hidden my-8" onClick={(e) => e.stopPropagation()}>
            
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-300 flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-blue-700" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {editingMember ? 'Edit Profile' : 'Register New Visitor'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleRequestCloseModal}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              
              {/* Photo & Type Switcher */}
              <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <div className="relative w-16 h-16 rounded-full bg-white border border-slate-300 overflow-hidden flex items-center justify-center shrink-0">
                  {photoBase64 ? (
                    <img src={photoBase64} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <button
                    type="button"
                    id="btn-open-camera-modal"
                    onClick={() => setIsCameraOpen(true)}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{photoBase64 ? 'Change Photo (Camera/File)' : 'Capture Photo (Camera/File)'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Roster Role:</span>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${targetType === 'STUDENT' ? 'bg-blue-900 text-white' : 'bg-purple-600 text-white'}`}>
                      {targetType === 'STUDENT' ? 'Student (Enrollment Officer certified)' : 'Visitor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name <span className="text-blue-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Bro. John Doe"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Occupation & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Occupation
                  </label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g. Teacher, Civil Servant"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Residential Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 10 Mission Way, Ikeja"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* First Lesson Week Joined & Referred By Sponsor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    First Lesson Week Joined (1-12)
                  </label>
                  <select
                    value={firstLessonWeek}
                    onChange={(e) => setFirstLessonWeek(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((wk) => (
                      <option key={wk} value={wk}>
                        Lesson {wk} (Prior weeks marked Exempt)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Invited / Referred By (Evangelism Credit)
                  </label>
                  <select
                    value={referredByMemberId}
                    onChange={(e) => setReferredByMemberId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="">-- Direct Visitor / Self --</option>
                    {members.filter(m => m.memberType === 'STUDENT').map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prayer Requests */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Prayer Requests & Special Needs
                </label>
                <textarea
                  rows={2}
                  value={prayerRequests}
                  onChange={(e) => setPrayerRequests(e.target.value)}
                  placeholder="e.g. Healing, career breakthrough, spiritual revival..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Secretary Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional pastoral notes..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              {saveMemberError && (
                <div role="alert" className="p-2.5 rounded-lg border border-red-300 bg-red-50 text-red-800 text-xs font-semibold">
                  {saveMemberError}
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isSavingMember}
                  className="flex-1 py-3 bg-blue-900 hover:bg-blue-800 disabled:opacity-60 text-white font-bold rounded-lg text-xs shadow-xs flex items-center justify-center gap-2 transition"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isSavingMember ? 'Saving…' : 'Save Member Profile'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Integrated Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(b64) => setPhotoBase64(b64)}
        title={`Capture Portrait Photo for ${fullName || 'Member'}`}
      />

      {/* Class Mass Import Modal (Name & Phone) */}
      <BulkMemberImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        currentWeek={currentWeek}
        classProfile={classProfile}
        existingMembers={members}
        onImportSuccess={async (newMembers) => {
          if (onSaveBulkMembers) {
            await onSaveBulkMembers(newMembers);
          } else {
            for (const m of newMembers) {
              await onSaveMember(m);
            }
          }
        }}
      />

      {/* One-Time Visitor Link Modal */}
      {activeLinkModalMember && activeLinkModalMember.oneTimeProfileToken && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-700">
                  <Link2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">
                    One-Time Profile Link
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    For {activeLinkModalMember.fullName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveLinkModalMember(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Send this secure passwordless link to <strong>{activeLinkModalMember.fullName}</strong>. They can complete their profile, address, and upload a photo directly without logging in.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Unique Visitor URL
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/#visitor-profile/${activeLinkModalMember.oneTimeProfileToken.token}`}
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/#visitor-profile/${activeLinkModalMember.oneTimeProfileToken?.token}`;
                    void navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `Hello ${activeLinkModalMember.fullName}! Welcome to GOFAMINT House of Favor Sunday School. Please take a moment to complete your visitor profile here: ${window.location.origin}/#visitor-profile/${activeLinkModalMember.oneTimeProfileToken.token}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 text-center"
              >
                <MessageCircle className="w-4 h-4 text-white" />
                <span>Send via WhatsApp</span>
              </a>
              <button
                type="button"
                onClick={() => setActiveLinkModalMember(null)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[10px] text-amber-800 font-medium">
              🔒 <strong>Single-use security:</strong> After the visitor confirms and saves their profile, this one-time link is permanently invalidated.
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
