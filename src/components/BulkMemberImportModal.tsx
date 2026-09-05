import React, { useState, useMemo } from 'react';
import { Member, MemberType, ClassProfile } from '../types';
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Edit3,
  Sparkles,
  Check,
  Download,
  Copy,
  Plus,
  Users,
  HeartHandshake,
  GraduationCap,
  Phone,
  User,
  Info,
  Calendar
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface BulkMemberImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: number;
  classProfile: ClassProfile | null;
  existingMembers?: Member[];
  onImportSuccess: (importedMembers: Member[]) => Promise<void> | void;
}

export interface ParsedMemberRow {
  id: string;
  sn: string;
  fullName: string;
  phone: string;
  memberType: MemberType;
  gender?: 'MALE' | 'FEMALE';
  firstLessonWeek: number;
  address?: string;
  occupation?: string;
  notes?: string;
  isValid: boolean;
  isDuplicate?: boolean;
  duplicateReason?: string;
  validationError?: string;
}

const SAMPLE_CSV_TEXT = `Name, Phone Number, Type (Optional)
Bro. John Adebayo, 08012345678, Student
Sis. Mary Johnson, 08023456789, Student
Bro. Peter James, 08034567890, Student
Sister Blessing Adeleke, 08051234567, Visitor
Bro. Timothy Kolawole, 08092223344, Student
Sis. Grace Olatunji, 07031122334, Visitor
Deacon Sunday Ogundipe, 08145566778, Student
Sis. Comfort Eze, 09067788990, Student`;

// Robust line parser that supports tabs, commas, pipes, semicolons, and quotes
function parseDelimitedLine(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map(s => s.trim().replace(/^["']|["']$/g, ''));
  }
  if (line.includes('|')) {
    return line.split('|').map(s => s.trim().replace(/^["']|["']$/g, ''));
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let delimiter = ',';
  if (line.includes(';') && !line.includes(',')) delimiter = ';';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' || char === "'") {
      if (inQuotes && nextChar === char) {
        current += char;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

// Clean phone numbers to standard format
function cleanPhoneNumber(rawPhone: string): string {
  if (!rawPhone) return '';
  let cleaned = rawPhone.trim();
  // Remove hyphens, dots, parentheses, and spaces
  cleaned = cleaned.replace(/[\s\-\(\)\.]/g, '');
  // Convert international +234 to standard 0
  if (cleaned.startsWith('+234')) {
    cleaned = '0' + cleaned.slice(4);
  } else if (cleaned.startsWith('234') && cleaned.length >= 13) {
    cleaned = '0' + cleaned.slice(3);
  }
  return cleaned;
}

// Detect gender from honorific title
function detectGender(name: string): 'MALE' | 'FEMALE' | undefined {
  const lower = (name || '').toLowerCase();
  if (
    lower.startsWith('bro') ||
    lower.startsWith('brother') ||
    lower.startsWith('mr') ||
    lower.startsWith('deacon ') ||
    lower.startsWith('elder') ||
    lower.startsWith('pastor')
  ) {
    return 'MALE';
  }
  if (
    lower.startsWith('sis') ||
    lower.startsWith('sister') ||
    lower.startsWith('mrs') ||
    lower.startsWith('miss') ||
    lower.startsWith('deaconess') ||
    lower.startsWith('lady')
  ) {
    return 'FEMALE';
  }
  return undefined;
}

export const BulkMemberImportModal: React.FC<BulkMemberImportModalProps> = ({
  isOpen,
  onClose,
  currentWeek,
  classProfile,
  existingMembers = [],
  onImportSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'PASTE' | 'UPLOAD'>('PASTE');
  const [pasteText, setPasteText] = useState(SAMPLE_CSV_TEXT);
  const [defaultMemberType, setDefaultMemberType] = useState<MemberType>('STUDENT');
  const [defaultStartWeek, setDefaultStartWeek] = useState<number>(currentWeek || 1);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // In-table manual edits
  const [manualRows, setManualRows] = useState<ParsedMemberRow[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);

  // Parse lines into structured rows
  const parsedRows: ParsedMemberRow[] = useMemo(() => {
    if (isManualMode && manualRows.length > 0) {
      return manualRows;
    }

    if (!pasteText.trim()) return [];

    const rawLines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return [];

    // Check if the first line is a header row
    const firstLineLower = (rawLines[0] || '').toLowerCase();
    const isHeaderRow =
      (firstLineLower.includes('name') || firstLineLower.includes('full name') || firstLineLower.includes('student') || firstLineLower.includes('member')) &&
      (firstLineLower.includes('phone') || firstLineLower.includes('tel') || firstLineLower.includes('mobile') || firstLineLower.includes('type') || firstLineLower.includes('s/n') || firstLineLower.includes('sn'));

    const dataLines = isHeaderRow ? rawLines.slice(1) : rawLines;

    const existingNames = new Set(existingMembers.map(m => (m.fullName || '').toLowerCase().trim()));
    const existingPhones = new Set(
      existingMembers.map(m => cleanPhoneNumber(m.phone)).filter(p => p.length >= 7)
    );

    return dataLines.map((line, idx) => {
      const parts = parseDelimitedLine(line);

      let sn = `${idx + 1}`;
      let fullName = '';
      let rawPhone = '';
      let rawType = '';
      let rawWeek = '';
      let rawAddress = '';
      let rawOccupation = '';

      // Pattern 1: Numbered format (S/N, Name, Phone, ...)
      if (parts.length >= 3 && !isNaN(Number(parts[0])) && parts[0].length <= 4) {
        sn = parts[0];
        fullName = parts[1] || '';
        rawPhone = parts[2] || '';
        rawType = parts[3] || '';
        rawWeek = parts[4] || '';
      }
      // Pattern 2: Name, Phone, Type, Week/Address
      else if (parts.length >= 2) {
        fullName = parts[0] || '';
        rawPhone = parts[1] || '';
        rawType = parts[2] || '';
        rawWeek = parts[3] || '';
        rawAddress = parts[4] || '';
      }
      // Pattern 3: Single cell containing Name and Phone (e.g. "Bro John - 08012345678")
      else if (parts.length === 1) {
        const text = parts[0];
        const phoneMatch = text.match(/(\+?234|0)[789][01]\d{8}/);
        if (phoneMatch) {
          rawPhone = phoneMatch[0];
          fullName = text.replace(phoneMatch[0], '').replace(/^[\s\-\:\,\;]+|[\s\-\:\,\;]+$/g, '');
        } else {
          fullName = text;
        }
      }

      // Strip leading bullet numbers if present in fullName e.g. "1. Bro. John"
      fullName = fullName.replace(/^\d+[\.\)\-]\s*/, '').trim();

      const phone = cleanPhoneNumber(rawPhone);

      // Determine Member Type
      let memberType: MemberType = defaultMemberType;
      const typeLower = (rawType || '').toLowerCase().trim();
      if (typeLower.includes('visit') || typeLower.includes('guest') || typeLower === 'v') {
        memberType = 'VISITOR';
      } else if (typeLower.includes('stud') || typeLower.includes('member') || typeLower === 's') {
        memberType = 'STUDENT';
      }

      // Determine First Lesson Week
      const parsedWeek = Number(rawWeek);
      const firstLessonWeek = (!isNaN(parsedWeek) && parsedWeek >= 1 && parsedWeek <= 13)
        ? parsedWeek
        : defaultStartWeek;

      // Validation check
      const isValid = fullName.length >= 2;
      let validationError: string | undefined = undefined;
      if (!isValid) {
        validationError = 'Missing or invalid full name';
      }

      // Duplicate check
      const nameKey = fullName.toLowerCase().trim();
      const isNameDup = existingNames.has(nameKey);
      const isPhoneDup = phone.length >= 7 && existingPhones.has(phone);
      const isDuplicate = isNameDup || isPhoneDup;
      let duplicateReason: string | undefined = undefined;
      if (isNameDup && isPhoneDup) duplicateReason = 'Name & Phone already exist in class';
      else if (isNameDup) duplicateReason = 'Name already registered in class';
      else if (isPhoneDup) duplicateReason = 'Phone number already registered in class';

      return {
        id: `parsed_mem_${idx}_${Date.now()}`,
        sn,
        fullName,
        phone,
        memberType,
        gender: detectGender(fullName),
        firstLessonWeek,
        address: rawAddress || '',
        occupation: rawOccupation || '',
        notes: 'Enrolled via Class Mass Import',
        isValid,
        isDuplicate,
        duplicateReason,
        validationError
      };
    });
  }, [pasteText, defaultMemberType, defaultStartWeek, existingMembers, isManualMode, manualRows]);

  // Summary counts
  const totalCount = parsedRows.length;
  const validRows = parsedRows.filter(r => r.isValid && (!skipDuplicates || !r.isDuplicate));
  const duplicateCount = parsedRows.filter(r => r.isDuplicate).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;
  const studentCount = validRows.filter(r => r.memberType === 'STUDENT').length;
  const visitorCount = validRows.filter(r => r.memberType === 'VISITOR').length;

  // Handle File Upload (.csv, .tsv, .txt)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPasteText(content);
        setIsManualMode(false);
        setActiveTab('PASTE');
      }
    };
    reader.readAsText(file);
  };

  // Download Sample Template CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      'Name,Phone Number,Type (Student or Visitor)\n' +
      'Bro. Emmanuel Okafor,08031234567,Student\n' +
      'Sis. Grace Adeleke,08123456789,Student\n' +
      'Sister Blessing Eze,07011223344,Visitor\n' +
      'Bro. David Oladipo,09087654321,Student\n' +
      'Sis. Funke Babatunde,08055667788,Visitor\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'GOFAMINT_HOF_Class_Mass_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy sample format to clipboard
  const handleCopySample = () => {
    navigator.clipboard.writeText(SAMPLE_CSV_TEXT);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Update a single parsed row
  const handleUpdateRow = (id: string, updates: Partial<ParsedMemberRow>) => {
    const current = isManualMode ? manualRows : [...parsedRows];
    const updated = current.map(r => (r.id === id ? { ...r, ...updates } : r));
    setManualRows(updated);
    setIsManualMode(true);
  };

  // Delete a parsed row
  const handleDeleteRow = (id: string) => {
    const current = isManualMode ? manualRows : [...parsedRows];
    const updated = current.filter(r => r.id !== id);
    setManualRows(updated);
    setIsManualMode(true);
  };

  // Add an empty row manually to table
  const handleAddEmptyRow = () => {
    const current = isManualMode ? manualRows : [...parsedRows];
    const newRow: ParsedMemberRow = {
      id: `manual_row_${Date.now()}`,
      sn: `${current.length + 1}`,
      fullName: '',
      phone: '',
      memberType: defaultMemberType,
      firstLessonWeek: defaultStartWeek,
      isValid: false,
      validationError: 'Enter member full name'
    };
    setManualRows([...current, newRow]);
    setIsManualMode(true);
  };

  // Commit Mass Import to Database
  const handleExecuteImport = async () => {
    if (validRows.length === 0) {
      alert('No valid member records found to import. Please ensure names are provided.');
      return;
    }

    setIsImporting(true);

    try {
      const membersToCreate: Member[] = validRows.map((r, index) => {
        const timestamp = new Date().toISOString();
        return {
          id: `mem_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
          classId: classProfile?.id || undefined,
          fullName: r.fullName.trim(),
          phone: r.phone.trim(),
          address: r.address?.trim() || '',
          occupation: r.occupation?.trim() || '',
          gender: r.gender,
          memberType: r.memberType,
          status: 'ACTIVE',
          firstLessonWeek: r.firstLessonWeek || 1,
          prayerRequests: '',
          notes: r.notes || 'Enrolled via Mass Import (Name & Phone). Profile can be updated later.',
          evangelismReferralCount: 0,
          createdAt: timestamp,
          updatedAt: timestamp
        };
      });

      await onImportSuccess(membersToCreate);

      // Trigger Confetti Celebration
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {}

      setIsImporting(false);
      onClose();
    } catch (err: any) {
      console.error('Mass import error:', err);
      alert(`Mass import failed: ${err.message || 'Unknown database error'}`);
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="bulk-member-import-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/80 backdrop-blur-xs overflow-y-auto animate-fade-in"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-950 text-white p-5 flex items-center justify-between border-b border-blue-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-800/80 border border-blue-700/60 flex items-center justify-center text-blue-200 shadow-inner">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-blue-950 px-2 py-0.5 rounded font-mono">
                  CLASS ROSTER TOOL
                </span>
                <span className="text-xs text-blue-200 font-medium">
                  {classProfile?.className || 'Active Sunday School Class'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
                Mass Import Members (Name & Phone)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-blue-300 hover:text-white hover:bg-white/10 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reassurance Banner: Profile Can Be Updated Later */}
        <div className="bg-amber-50 border-b border-amber-200/80 p-3.5 px-5 flex items-start gap-2.5 text-amber-900 text-xs shrink-0">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              ⚡ Fast Onboarding Mode: Only <strong>Name</strong> and <strong>Phone Number</strong> are required.
            </p>
            <p className="text-amber-800 text-[11px] mt-0.5">
              Full member profiles (address, occupation, date of birth, photo, prayer requests) can be updated anytime later by the teacher/secretary from the Roster view or through the public QR Portal.
            </p>
          </div>
        </div>

        {/* Tabs & Controls */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Action Tabs & Template Tools */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setIsManualMode(false);
                  setActiveTab('PASTE');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'PASTE'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste List / Spreadsheet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsManualMode(false);
                  setActiveTab('UPLOAD');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'UPLOAD'
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV / Excel</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySample}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5"
                title="Copy sample format to clipboard"
              >
                {copyFeedback ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copyFeedback ? 'Copied!' : 'Copy Sample'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition flex items-center gap-1.5"
                title="Download CSV template file"
              >
                <Download className="w-3.5 h-3.5 text-blue-700" />
                <span>Download Template</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Paste Text Input */}
          {activeTab === 'PASTE' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <span>Paste Names & Phone Numbers (One person per line):</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Supported formats: "Name, Phone" • Excel Table Paste • "Name | Phone"
                </span>
              </div>

              <textarea
                id="mass-import-paste-area"
                rows={6}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  setIsManualMode(false);
                }}
                placeholder="Paste lines here... e.g.&#10;Bro. John Adebayo, 08012345678&#10;Sis. Mary Johnson, 08023456789, Student&#10;Sister Blessing Adeleke, 08051234567, Visitor"
                className="w-full font-mono text-xs p-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
              />
            </div>
          )}

          {/* Tab 2: File Upload */}
          {activeTab === 'UPLOAD' && (
            <div className="p-8 border-2 border-dashed border-slate-300 rounded-2xl text-center bg-slate-50 hover:bg-slate-100/80 transition flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-900 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  Select a CSV, TSV, or TXT file from your device
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exports from Excel, Google Sheets, or WhatsApp contact lists with Name and Phone
                </p>
              </div>

              <label className="cursor-pointer px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 inline-flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Browse File</span>
                <input
                  type="file"
                  accept=".csv, .tsv, .txt, text/csv, text/plain"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Batch Configuration Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Default Roster Type:
              </label>
              <select
                value={defaultMemberType}
                onChange={(e) => {
                  const newType = e.target.value as MemberType;
                  setDefaultMemberType(newType);
                  if (isManualMode) {
                    setManualRows(manualRows.map(r => ({ ...r, memberType: newType })));
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
              >
                <option value="STUDENT">Student (Full Class Member)</option>
                <option value="VISITOR">Visitor (First-time / Guest)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Enrolled Starting Week:
              </label>
              <select
                value={defaultStartWeek}
                onChange={(e) => {
                  const wk = Number(e.target.value);
                  setDefaultStartWeek(wk);
                  if (isManualMode) {
                    setManualRows(manualRows.map(r => ({ ...r, firstLessonWeek: wk })));
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    Week {i + 1} {i + 1 === currentWeek ? '(Current Week)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <input
                type="checkbox"
                id="skip-duplicates-check"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="w-4 h-4 text-blue-900 rounded border-slate-300 focus:ring-blue-600"
              />
              <label htmlFor="skip-duplicates-check" className="font-semibold text-slate-700 cursor-pointer select-none">
                Skip existing names/phones ({duplicateCount} detected)
              </label>
            </div>
          </div>

          {/* Live Validation Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-[10px] font-bold text-blue-700 uppercase">Parsed Records</span>
              <p className="text-xl font-black text-blue-950 mt-0.5">{totalCount}</p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Ready to Import</span>
              <p className="text-xl font-black text-emerald-950 mt-0.5">{validRows.length}</p>
            </div>

            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <span className="text-[10px] font-bold text-purple-700 uppercase">Students / Visitors</span>
              <p className="text-xl font-black text-purple-950 mt-0.5">
                {studentCount} <span className="text-xs font-normal text-purple-700">/ {visitorCount}</span>
              </p>
            </div>

            <div className={`p-3 rounded-xl border ${
              duplicateCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-[10px] font-bold text-slate-600 uppercase">Existing Duplicates</span>
              <p className={`text-xl font-black mt-0.5 ${duplicateCount > 0 ? 'text-amber-900' : 'text-slate-700'}`}>
                {duplicateCount}
              </p>
            </div>
          </div>

          {/* Live Interactive Preview Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
            <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Live Data Preview & In-Table Adjuster ({parsedRows.length} Rows)</span>
              </span>

              <button
                type="button"
                onClick={handleAddEmptyRow}
                className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition active:scale-95"
              >
                <Plus className="w-3 h-3" />
                <span>Add Row</span>
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {parsedRows.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  No records parsed yet. Type or paste your member list above.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-2 px-3 w-10">#</th>
                      <th className="py-2 px-3">Full Name</th>
                      <th className="py-2 px-3">Phone Number</th>
                      <th className="py-2 px-3 w-32">Type</th>
                      <th className="py-2 px-3 w-20">Week</th>
                      <th className="py-2 px-3 w-28">Status</th>
                      <th className="py-2 px-3 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((row, idx) => {
                      const isSkipped = skipDuplicates && row.isDuplicate;

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50 transition ${
                            isSkipped
                              ? 'bg-amber-50/50 opacity-60'
                              : !row.isValid
                              ? 'bg-red-50/60'
                              : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Editable Full Name */}
                          <td className="py-1.5 px-3">
                            <input
                              type="text"
                              value={row.fullName}
                              onChange={(e) =>
                                handleUpdateRow(row.id, {
                                  fullName: e.target.value,
                                  isValid: e.target.value.trim().length >= 2,
                                  gender: detectGender(e.target.value)
                                })
                              }
                              placeholder="Full Name (required)"
                              className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 focus:outline-none py-1 font-semibold text-slate-900 text-xs"
                            />
                          </td>

                          {/* Editable Phone */}
                          <td className="py-1.5 px-3">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <input
                                type="text"
                                value={row.phone}
                                onChange={(e) =>
                                  handleUpdateRow(row.id, {
                                    phone: cleanPhoneNumber(e.target.value)
                                  })
                                }
                                placeholder="080..."
                                className="w-full bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 focus:outline-none py-1 font-mono text-slate-900 text-xs"
                              />
                            </div>
                          </td>

                          {/* Member Type Selector */}
                          <td className="py-1.5 px-3">
                            <select
                              value={row.memberType}
                              onChange={(e) =>
                                handleUpdateRow(row.id, {
                                  memberType: e.target.value as MemberType
                                })
                              }
                              className={`w-full py-1 px-2 rounded-md font-bold text-[11px] border focus:outline-none ${
                                row.memberType === 'STUDENT'
                                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                                  : 'bg-purple-50 text-purple-900 border-purple-200'
                              }`}
                            >
                              <option value="STUDENT">Student</option>
                              <option value="VISITOR">Visitor</option>
                            </select>
                          </td>

                          {/* First Lesson Week */}
                          <td className="py-1.5 px-3">
                            <select
                              value={row.firstLessonWeek}
                              onChange={(e) =>
                                handleUpdateRow(row.id, {
                                  firstLessonWeek: Number(e.target.value)
                                })
                              }
                              className="w-full py-1 px-1.5 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-semibold text-slate-800 focus:outline-none"
                            >
                              {Array.from({ length: 12 }).map((_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  Wk {i + 1}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Status Badge */}
                          <td className="py-1.5 px-3">
                            {row.isDuplicate ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded"
                                title={row.duplicateReason}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>{isSkipped ? 'Skipping Dup' : 'Duplicate'}</span>
                              </span>
                            ) : !row.isValid ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-black bg-red-100 text-red-900 px-1.5 py-0.5 rounded"
                                title={row.validationError}
                              >
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                                <span>Invalid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded">
                                <Check className="w-3 h-3 text-emerald-700" />
                                <span>Ready</span>
                              </span>
                            )}
                          </td>

                          {/* Delete Button */}
                          <td className="py-1.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-50 p-4 px-5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span>
              Target Class: <strong>{classProfile?.className || 'Active Class'}</strong>
            </span>
            <span>•</span>
            <span>
              Assigning: <strong>{validRows.length}</strong> new members
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="w-1/2 sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>

            <button
              type="button"
              id="btn-execute-mass-import"
              onClick={handleExecuteImport}
              disabled={isImporting || validRows.length === 0}
              className="w-1/2 sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-2 active:scale-95"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Import {validRows.length} Members Now</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
