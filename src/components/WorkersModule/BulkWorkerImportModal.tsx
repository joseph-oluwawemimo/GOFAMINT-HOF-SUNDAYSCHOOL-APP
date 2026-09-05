import React, { useState, useMemo } from 'react';
import { WorkerProfile, WorkerCategoryDef } from '../../types';
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
  Filter
} from 'lucide-react';
import { calculateWorkerProfileCompleteness } from '../../utils/workerProfileUtils';

interface BulkWorkerImportModalProps {
  isOpen: boolean;
  categoriesList: WorkerCategoryDef[];
  departmentsList: string[];
  existingWorkers?: WorkerProfile[];
  onClose: () => void;
  onImportSuccess?: (importedWorkers: WorkerProfile[]) => Promise<void>;
  onSaveBulk?: (importedWorkers: WorkerProfile[]) => Promise<void>;
}

export interface ParsedWorkerRow {
  id: string;
  sn: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  department: string;
  assignedClass: string;
  duty: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  isValid: boolean;
  validationError?: string;
}

export interface ImportColumnDef {
  key: string;
  label: string;
  required?: boolean;
}

export const AVAILABLE_IMPORT_COLUMNS: ImportColumnDef[] = [
  { key: 'fullName', label: 'Full Name', required: true },
  { key: 'department', label: 'Department' },
  { key: 'assignedClass', label: 'Class' },
  { key: 'duty', label: 'Duty / Role' },
  { key: 'gender', label: 'Sex' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'whatsappNumber', label: 'WhatsApp Number' },
  { key: 'address', label: 'Address' }
];

export function buildDynamicTemplate(cols: string[]): string {
  const headers = ['S/N'];
  cols.forEach(c => {
    const f = AVAILABLE_IMPORT_COLUMNS.find(ac => ac.key === c);
    if (f) headers.push(f.label);
  });

  const row1 = ['1'];
  const row2 = ['2'];
  cols.forEach(c => {
    if (c === 'fullName') { row1.push('Bro. Victor Akindele'); row2.push('Sis. Fadekemi Oladapo'); }
    else if (c === 'department') { row1.push('Sunday School (Youth)'); row2.push('Sunday School (Adult)'); }
    else if (c === 'assignedClass') { row1.push('Youth Class A'); row2.push('Adult Yoruba'); }
    else if (c === 'duty') { row1.push('Secretary'); row2.push('Class Teacher'); }
    else if (c === 'gender') { row1.push('Male'); row2.push('Female'); }
    else if (c === 'phone') { row1.push('08012345678'); row2.push('08098765432'); }
    else if (c === 'whatsappNumber') { row1.push('08012345678'); row2.push('08098765432'); }
    else if (c === 'address') { row1.push('12 Church St, Lagos'); row2.push('45 Peace Ave, Ikeja'); }
  });

  return [headers.join(','), row1.join(','), row2.join(',')].join('\n');
}

const SAMPLE_CSV_TEXT = `S/N,Name,Sex,Department,Class,Duty,Phone Number,WhatsApp Number,Address
1,Bro. John Adebayo,Male,Sunday School,Adult English,Class Teacher,08012345678,08012345678,12 Church Street Lagos
2,Sis. Mary Johnson,Female,Sunday School,Beginner 1,Assistant Teacher,08023456789,08023456789,24 Unity Road Lagos
3,Bro. Peter James,Male,Choir,Youth Class,Choir Master,08034567890,08034567890,8 Grace Avenue Ikeja
4,Deaconess Bola Adeleke,Female,Ushering,Adult Yoruba,Head Usher,08051234567,08051234567,15 Faith Estate Surulere
5,Bro. Timothy Kolawole,Male,Evangelism,Teens Class,Evangelism Leader,08092223344,08092223344,19 Zion Close Festac`;

// Robust Line Parser that handles CSV, TSV (Excel paste), Pipe, and quotes
function parseCsvLine(line: string): string[] {
  // If tabs are present, prioritize tab-splitting (direct copy-paste from Excel / Google Sheets)
  if (line.includes('\t')) {
    return line.split('\t').map(s => s.trim().replace(/^["']|["']$/g, ''));
  }
  // If pipe delimiter is present
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
        i++; // skip escaped quote
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

export const BulkWorkerImportModal: React.FC<BulkWorkerImportModalProps> = ({
  isOpen,
  categoriesList,
  departmentsList,
  onClose,
  onImportSuccess,
  onSaveBulk,
  existingWorkers = []
}) => {
  const [activeTab, setActiveTab] = useState<'PASTE' | 'UPLOAD'>('PASTE');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'fullName', 'department', 'assignedClass', 'phone'
  ]);
  const [pasteText, setPasteText] = useState(SAMPLE_CSV_TEXT);
  const [defaultDepartment, setDefaultDepartment] = useState('Sunday School');
  const [defaultDuty, setDefaultDuty] = useState('Class Teacher');
  const [isImporting, setIsImporting] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Parse text into structured records using format:
  // Supports dynamic headers or matching selectedColumns
  const parsedRows: ParsedWorkerRow[] = useMemo(() => {
    if (!pasteText.trim()) return [];

    const rawLines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return [];

    // Check if the first line is a header row
    const firstLineLower = (rawLines[0] || '').toLowerCase();
    const isHeaderRow = 
      (firstLineLower.includes('name') || firstLineLower.includes('full name') || firstLineLower.includes('worker')) &&
      (firstLineLower.includes('phone') || firstLineLower.includes('duty') || firstLineLower.includes('department') || firstLineLower.includes('dept') || firstLineLower.includes('sex') || firstLineLower.includes('gender') || firstLineLower.includes('s/n') || firstLineLower.includes('sn') || firstLineLower.includes('address') || firstLineLower.includes('class'));

    const headerMap: { [key: string]: number } = {};
    if (isHeaderRow) {
      const headerParts = parseCsvLine(rawLines[0]).map(h => h.toLowerCase().trim());
      headerParts.forEach((h, idx) => {
        if (h === 's/n' || h === 'sn' || h === 'no' || h === '#') headerMap['sn'] = idx;
        else if (h.includes('name') && headerMap['fullName'] === undefined) headerMap['fullName'] = idx;
        else if ((h.includes('sex') || h.includes('gender')) && headerMap['gender'] === undefined) headerMap['gender'] = idx;
        else if ((h.includes('dept') || h.includes('department')) && headerMap['department'] === undefined) headerMap['department'] = idx;
        else if (h.includes('class') && headerMap['assignedClass'] === undefined) headerMap['assignedClass'] = idx;
        else if ((h.includes('duty') || h.includes('role')) && headerMap['duty'] === undefined) headerMap['duty'] = idx;
        else if ((h.includes('phone') || h.includes('mobile') || h.includes('tel')) && headerMap['phone'] === undefined) headerMap['phone'] = idx;
        else if ((h.includes('whatsapp') || h.includes('wa')) && headerMap['whatsappNumber'] === undefined) headerMap['whatsappNumber'] = idx;
        else if ((h.includes('address') || h.includes('location')) && headerMap['address'] === undefined) headerMap['address'] = idx;
      });
    }

    const dataLines = isHeaderRow ? rawLines.slice(1) : rawLines;

    return dataLines.map((line, idx) => {
      const parts = parseCsvLine(line);

      let sn = `${idx + 1}`;
      let fullName = '';
      let rawSex = '';
      let department = defaultDepartment;
      let assignedClass = '';
      let duty = defaultDuty;
      let phone = '';
      let whatsappNumber = '';
      let address = 'Assembly District';

      if (isHeaderRow && headerMap['fullName'] !== undefined) {
        if (headerMap['sn'] !== undefined && parts[headerMap['sn']]) sn = parts[headerMap['sn']];
        if (headerMap['fullName'] !== undefined) fullName = parts[headerMap['fullName']] || '';
        if (headerMap['gender'] !== undefined) rawSex = parts[headerMap['gender']] || '';
        if (headerMap['department'] !== undefined) department = parts[headerMap['department']] || defaultDepartment;
        if (headerMap['assignedClass'] !== undefined) assignedClass = parts[headerMap['assignedClass']] || '';
        if (headerMap['duty'] !== undefined) duty = parts[headerMap['duty']] || defaultDuty;
        if (headerMap['phone'] !== undefined) phone = parts[headerMap['phone']] || '';
        if (headerMap['whatsappNumber'] !== undefined) whatsappNumber = parts[headerMap['whatsappNumber']] || '';
        if (headerMap['address'] !== undefined) address = parts[headerMap['address']] || 'Assembly District';
      } else {
        // Fallback: standard 9-column format
        if (parts.length >= 9) {
          sn = parts[0] || `${idx + 1}`;
          fullName = parts[1] || '';
          rawSex = parts[2] || '';
          department = parts[3] || defaultDepartment;
          assignedClass = parts[4] || '';
          duty = parts[5] || defaultDuty;
          phone = parts[6] || '';
          whatsappNumber = parts[7] || parts[6] || '';
          address = parts[8] || 'Assembly District';
        } else {
          // Map parts sequentially using selectedColumns
          let colIdx = 0;
          if (parts.length > selectedColumns.length && !isNaN(Number(parts[0]))) {
            sn = parts[0];
            colIdx = 1;
          }
          selectedColumns.forEach(colKey => {
            const val = parts[colIdx] || '';
            if (colKey === 'fullName') fullName = val;
            else if (colKey === 'department') department = val || defaultDepartment;
            else if (colKey === 'assignedClass') assignedClass = val;
            else if (colKey === 'duty') duty = val || defaultDuty;
            else if (colKey === 'gender') rawSex = val;
            else if (colKey === 'phone') phone = val;
            else if (colKey === 'whatsappNumber') whatsappNumber = val;
            else if (colKey === 'address') address = val || 'Assembly District';
            colIdx++;
          });
        }
      }

      // Gender normalization
      const sexLower = (rawSex || '').toLowerCase();
      const nameLower = (fullName || '').toLowerCase();
      let gender: 'MALE' | 'FEMALE' = 'MALE';

      if (
        sexLower.startsWith('f') || 
        sexLower.includes('female') || 
        sexLower.includes('sis') || 
        sexLower.includes('woman') ||
        sexLower.includes('deaconess') ||
        nameLower.includes('sister') ||
        nameLower.includes('sis.') ||
        nameLower.includes('deaconess') ||
        nameLower.includes('mrs')
      ) {
        gender = 'FEMALE';
      } else if (
        sexLower.startsWith('m') || 
        sexLower.includes('male') || 
        sexLower.includes('bro') || 
        nameLower.includes('brother') ||
        nameLower.includes('bro.') ||
        nameLower.includes('pastor') ||
        nameLower.includes('deacon')
      ) {
        gender = 'MALE';
      }

      // Validation - resilient: fullName is the essential field (phone is completely optional)
      let isValid = true;
      let validationError = '';

      if (!fullName || fullName.trim().length === 0) {
        isValid = false;
        validationError = 'Missing Full Name';
      }

      return {
        id: `row_${idx}_${Date.now()}`,
        sn: sn || `${idx + 1}`,
        fullName: fullName.trim(),
        gender,
        department: department.trim() || defaultDepartment,
        assignedClass: assignedClass && assignedClass !== '-' ? assignedClass.trim() : '-',
        duty: duty.trim() || defaultDuty,
        phone: phone.trim(),
        whatsappNumber: whatsappNumber.trim() || phone.trim(),
        address: address.trim() || 'Assembly District',
        isValid,
        validationError
      };
    });
  }, [pasteText, defaultDepartment, defaultDuty, selectedColumns]);

  const validRows = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setPasteText(content);
        setActiveTab('PASTE');
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveRow = (index: number) => {
    const lines = pasteText.split(/\r?\n/).filter(l => l.trim().length > 0);
    // If first line is header, shift index
    const firstLineLower = lines[0]?.toLowerCase() || '';
    const hasHeader = 
      firstLineLower.includes('name') && 
      (firstLineLower.includes('phone') || firstLineLower.includes('duty') || firstLineLower.includes('s/n'));
    
    const targetIdx = hasHeader ? index + 1 : index;
    if (lines[targetIdx] !== undefined) {
      lines.splice(targetIdx, 1);
      setPasteText(lines.join('\n'));
    }
  };

  const handleUpdateRowField = (index: number, field: keyof ParsedWorkerRow, value: any) => {
    const lines = pasteText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const firstLineLower = lines[0]?.toLowerCase() || '';
    const hasHeader = 
      firstLineLower.includes('name') && 
      (firstLineLower.includes('phone') || firstLineLower.includes('duty') || firstLineLower.includes('s/n'));
    
    const targetIdx = hasHeader ? index + 1 : index;
    if (lines[targetIdx] === undefined) return;

    const parts = parseCsvLine(lines[targetIdx]);
    
    // Ensure we have at least 9 parts
    while (parts.length < 9) {
      parts.push('');
    }

    if (field === 'sn') parts[0] = value;
    if (field === 'fullName') parts[1] = value;
    if (field === 'gender') parts[2] = value === 'FEMALE' ? 'Female' : 'Male';
    if (field === 'department') parts[3] = value;
    if (field === 'assignedClass') parts[4] = value;
    if (field === 'duty') parts[5] = value;
    if (field === 'phone') parts[6] = value;
    if (field === 'whatsappNumber') parts[7] = value;
    if (field === 'address') parts[8] = value;

    lines[targetIdx] = parts.join(',');
    setPasteText(lines.join('\n'));
  };

  const handleLoadDynamicTemplate = () => {
    setPasteText(buildDynamicTemplate(selectedColumns));
  };

  const handleCopyTemplate = () => {
    const template = buildDynamicTemplate(selectedColumns);
    navigator.clipboard.writeText(template);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  const handleDownloadTemplate = () => {
    const template = buildDynamicTemplate(selectedColumns);
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gofamint_workers_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = async () => {
    if (validRows.length === 0) {
      alert('Please provide at least one valid worker with a name.');
      return;
    }

    setIsImporting(true);
    try {
      const timestamp = Date.now();
      const generatedProfiles: WorkerProfile[] = validRows.map((r, i) => {
        const uniqueSuffix = (timestamp + i).toString().slice(-6);
        const qrCode = `GOFAMINT_HOF-WRK-${uniqueSuffix}`;
        const dutyRole = r.duty && r.duty !== '-' ? r.duty : defaultDuty;

        return {
          id: `w_${timestamp}_${i}`,
          sn: r.sn || `${i + 1}`,
          fullName: r.fullName.trim(),
          gender: r.gender,
          department: r.department.trim() || defaultDepartment,
          assignedClass: r.assignedClass && r.assignedClass !== '-' ? r.assignedClass.trim() : undefined,
          duty: dutyRole.trim(),
          categories: [dutyRole.trim()],
          phone: r.phone.trim(),
          whatsappNumber: (r.whatsappNumber || r.phone).trim(),
          address: r.address.trim() || 'Assembly District',
          status: 'ACTIVE',
          qrCodeToken: qrCode,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });

      const importHandler = onImportSuccess || onSaveBulk;
      if (importHandler) {
        await importHandler(generatedProfiles);
      } else {
        throw new Error('Import function handler not provided');
      }

      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      alert(`Import error: ${err?.message || 'Failed to complete import'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-wide font-['Cinzel',serif]">
                  Bulk Workers Import
                </h2>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold">
                  9-Column Standard
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Import church workers with S/N, Name, Sex, Department, Class, Duty, Phone, WhatsApp & Address
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition"
              title="Download standard CSV template"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download CSV Template</span>
            </button>

            <button
              type="button"
              onClick={handleCopyTemplate}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition"
              title="Copy sample format to clipboard"
            >
              {copyFeedback ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Copy Format</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Dynamic Column Checklist Selector */}
        <div className="bg-amber-50/90 border-b border-amber-200 px-4 sm:px-6 py-3 space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-black uppercase tracking-wider text-slate-900 text-[11px]">
                Check Columns Present In Your Data:
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                (Select the fields you have e.g. Name, Department, Class. Missing fields will be filled later via clock-in prompt)
              </span>
            </div>

            <button
              type="button"
              onClick={handleLoadDynamicTemplate}
              className="text-[11px] font-black text-blue-900 hover:text-blue-700 underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>Load Template for Checked Columns</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {AVAILABLE_IMPORT_COLUMNS.map(col => {
              const isChecked = selectedColumns.includes(col.key);
              return (
                <label
                  key={col.key}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    isChecked
                      ? 'bg-blue-900 text-white border-blue-900 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={col.required}
                    onChange={(e) => {
                      if (col.required) return;
                      if (e.target.checked) {
                        setSelectedColumns(prev => [...prev, col.key]);
                      } else {
                        setSelectedColumns(prev => prev.filter(k => k !== col.key));
                      }
                    }}
                    className="rounded text-blue-900 w-3.5 h-3.5"
                  />
                  <span>{col.label}{col.required ? ' (Required)' : ''}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Tab Switcher & Defaults */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('PASTE')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
                activeTab === 'PASTE'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Paste Workers CSV / Table</span>
            </button>
            <button
              onClick={() => setActiveTab('UPLOAD')}
              className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition ${
                activeTab === 'UPLOAD'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Upload CSV / Excel File</span>
            </button>
          </div>

          {/* Default Assignment Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg">
              <span className="text-slate-500 font-medium">Default Dept:</span>
              <select
                value={defaultDepartment}
                onChange={e => setDefaultDepartment(e.target.value)}
                className="font-bold text-slate-800 bg-transparent outline-hidden cursor-pointer"
              >
                {departmentsList.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 border border-slate-300 rounded-lg">
              <span className="text-slate-500 font-medium">Default Duty:</span>
              <select
                value={defaultDuty}
                onChange={e => setDefaultDuty(e.target.value)}
                className="font-bold text-slate-800 bg-transparent outline-hidden cursor-pointer"
              >
                {categoriesList.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          
          {activeTab === 'PASTE' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Paste Workers Data</span>
                  <span className="text-[10px] text-slate-500 font-normal">(One worker per row)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPasteText(SAMPLE_CSV_TEXT)}
                    className="text-blue-700 hover:text-blue-900 font-bold text-xs underline"
                  >
                    Reset to Sample Data
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setPasteText('')}
                    className="text-rose-600 hover:text-rose-800 font-bold text-xs"
                  >
                    Clear Text
                  </button>
                </div>
              </div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={6}
                placeholder="S/N,Name,Sex,Department,Class,Duty,Phone Number,WhatsApp Number,Address&#10;1,Bro. John Adebayo,Male,Sunday School,Adult English,Class Teacher,08012345678,08012345678,12 Church Street Lagos"
                className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-hidden bg-slate-950 text-amber-300 leading-relaxed shadow-inner"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3 bg-slate-50">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 mx-auto flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-800">
                  Select CSV, TXT or Spreadsheet file
                </h3>
                <p className="text-xs text-slate-500">
                  Ensure columns follow: S/N, Name, Sex, Department, Class, Duty, Phone Number, WhatsApp Number, Address
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-900 file:text-white hover:file:bg-blue-800 cursor-pointer"
              />
            </div>
          )}

          {/* Interactive Live Validation Preview */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Live Import Preview
                </h3>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-full">
                  {validRows.length} Valid Records
                </span>
                {invalidRows.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold rounded-full">
                    {invalidRows.length} Issues Detected
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">
                You can directly edit any field in the table below before importing
              </span>
            </div>

            {parsedRows.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                No workers found in input. Paste your workers list above or upload a CSV.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="max-h-72 overflow-x-auto overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                    <thead className="bg-slate-900 text-amber-300 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-800 z-10 text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">S/N</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-center">Completeness</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Sex</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Class</th>
                        <th className="py-2.5 px-3">Duty</th>
                        <th className="py-2.5 px-3">Phone Number</th>
                        <th className="py-2.5 px-3">WhatsApp Number</th>
                        <th className="py-2.5 px-3">Address</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                      {parsedRows.map((row, idx) => (
                        <tr key={row.id} className={`hover:bg-slate-50 transition ${!row.isValid ? 'bg-rose-50/60' : ''}`}>
                          
                          {/* S/N */}
                          <td className="py-2 px-3 text-center font-mono font-bold text-slate-600 text-[11px]">
                            {editingRowId === row.id ? (
                              <input
                                type="text"
                                value={row.sn}
                                onChange={e => handleUpdateRowField(idx, 'sn', e.target.value)}
                                className="w-10 px-1 py-0.5 border rounded border-blue-400 bg-white text-center font-bold"
                              />
                            ) : (
                              row.sn || `${idx + 1}`
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-700 font-bold text-[11px]" title={row.validationError}>
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {row.validationError}
                              </span>
                            )}
                          </td>

                          {/* Completeness */}
                          <td className="py-2 px-3 text-center">
                            {(() => {
                              const comp = calculateWorkerProfileCompleteness({
                                id: row.id,
                                sn: row.sn,
                                fullName: row.fullName,
                                gender: row.gender,
                                department: row.department,
                                assignedClass: row.assignedClass,
                                duty: row.duty,
                                phone: row.phone,
                                whatsappNumber: row.whatsappNumber,
                                address: row.address,
                                qrCodeToken: '',
                                categories: [row.duty],
                                status: 'ACTIVE',
                                createdAt: '',
                                updatedAt: ''
                              });
                              return (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                  comp.percentage >= 80 
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                    : comp.percentage >= 50
                                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-300'
                                }`} title={`Completeness: ${comp.percentage}%. Missing: ${comp.missingFields.join(', ')}`}>
                                  {comp.percentage}%
                                </span>
                              );
                            })()}
                          </td>

                          {/* Name */}
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {editingRowId === row.id ? (
                              <input
                                type="text"
                                value={row.fullName}
                                onChange={e => handleUpdateRowField(idx, 'fullName', e.target.value)}
                                className="px-2 py-0.5 border rounded border-blue-400 bg-white w-36"
                              />
                            ) : (
                              row.fullName || <span className="text-rose-500 italic">Empty</span>
                            )}
                          </td>

                          {/* Sex */}
                          <td className="py-2 px-3">
                            {editingRowId === row.id ? (
                              <select
                                value={row.gender}
                                onChange={e => handleUpdateRowField(idx, 'gender', e.target.value)}
                                className="px-1 py-0.5 border rounded border-blue-400 bg-white text-xs"
                              >
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                row.gender === 'FEMALE' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {row.gender === 'FEMALE' ? 'Female' : 'Male'}
                              </span>
                            )}
                          </td>

                          {/* Department */}
                          <td className="py-2 px-3">
                            {editingRowId === row.id ? (
                              <input
                                type="text"
                                value={row.department}
                                onChange={e => handleUpdateRowField(idx, 'department', e.target.value)}
                                className="px-2 py-0.5 border rounded border-blue-400 bg-white w-28"
                              />
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px] border border-slate-200">
                                {row.department}
                              </span>
                            )}
                          </td>

                          {/* Class */}
                          <td className="py-2 px-3 font-medium text-slate-700">
                            {editingRowId === row.id ? (
                              <input
                                type="text"
                                value={row.assignedClass}
                                onChange={e => handleUpdateRowField(idx, 'assignedClass', e.target.value)}
                                className="px-2 py-0.5 border rounded border-blue-400 bg-white w-24"
                              />
                            ) : (
                              row.assignedClass && row.assignedClass !== '-' ? (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-800 rounded text-[11px] font-semibold border border-indigo-200">
                                  {row.assignedClass}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">-</span>
                              )
                            )}
                          </td>

                          {/* Duty */}
                          <td className="py-2 px-3">
                            {editingRowId === row.id ? (
                              <input
                                type="text"
                                value={row.duty}
                                onChange={e => handleUpdateRowField(idx, 'duty', e.target.value)}
                                className="px-2 py-0.5 border rounded border-blue-400 bg-white w-28"
                              />
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-900 rounded font-semibold text-[11px] border border-amber-200">
                                {row.duty}
                              </span>
                            )}
                          </td>

                          {/* Phone Number */}
                          <td className="py-2 px-3 font-mono">
                            {editingRowId === row.id ? (
                              <input
                                type="text"
                                value={row.phone}
                                onChange={e => handleUpdateRowField(idx, 'phone', e.target.value)}
                                className="px-2 py-0.5 border rounded border-blue-400 bg-white w-28 font-mono"
                              />
                            ) : (
                              row.phone || <span className="text-rose-500 italic">Empty</span>
                            )}
                          </td>

                          {/* WhatsApp Number */}
                          <td className="py-2 px-3 font-mono text-emerald-700">
                            {editingRowId === row.id ? (
                              <input
                                type="text"
                                value={row.whatsappNumber}
                                onChange={e => handleUpdateRowField(idx, 'whatsappNumber', e.target.value)}
                                className="px-2 py-0.5 border rounded border-blue-400 bg-white w-28 font-mono"
                              />
                            ) : (
                              row.whatsappNumber || row.phone
                            )}
                          </td>

                          {/* Address */}
                          <td className="py-2 px-3 max-w-[150px] truncate text-slate-600">
                            {editingRowId === row.id ? (
                              <input
                                type="text"
                                value={row.address}
                                onChange={e => handleUpdateRowField(idx, 'address', e.target.value)}
                                className="px-2 py-0.5 border rounded border-blue-400 bg-white w-36"
                              />
                            ) : (
                              row.address || 'Assembly District'
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingRowId(editingRowId === row.id ? null : row.id)}
                                className={`p-1.5 rounded transition ${
                                  editingRowId === row.id 
                                    ? 'bg-blue-900 text-white' 
                                    : 'text-slate-500 hover:text-blue-700 hover:bg-slate-200'
                                }`}
                                title="Edit row inline"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-100 transition"
                                title="Remove row"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <span className="font-bold text-slate-900">{validRows.length} workers ready for import.</span>
            <span>Each worker receives a personal QR Code token and ID.</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={validRows.length === 0 || isImporting}
              onClick={handleExecuteImport}
              className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md transition flex items-center gap-2"
            >
              <Check className="w-4 h-4 text-amber-300" />
              <span>{isImporting ? 'Importing...' : `Import ${validRows.length} Workers`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
