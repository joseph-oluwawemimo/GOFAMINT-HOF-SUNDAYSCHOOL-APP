import React, { useState, useRef } from 'react';
import { WorkerPunctualityHonor } from '../../utils/quarterScheduleUtils';
import { QuarterData } from '../../types';
import { 
  Trophy, Printer, Copy, Check, X, Award, 
  Sparkles, BookOpen, Church, Download, ShieldCheck, Star
} from 'lucide-react';

interface AdmonitionCitationPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeQuarter: QuarterData;
  top3PrepClass: WorkerPunctualityHonor[];
  top3Sunday: WorkerPunctualityHonor[];
  averageSundayPunctuality: number;
  averagePrepPunctuality: number;
}

export const AdmonitionCitationPrintModal: React.FC<AdmonitionCitationPrintModalProps> = ({
  isOpen,
  onClose,
  activeQuarter,
  top3PrepClass,
  top3Sunday,
  averageSundayPunctuality,
  averagePrepPunctuality
}) => {
  const [selectedTab, setSelectedTab] = useState<'FULL_CITATION' | 'INDIVIDUAL_CERTIFICATE'>('FULL_CITATION');
  const [selectedLaureateId, setSelectedLaureateId] = useState<string>(
    top3Sunday[0]?.workerId || top3PrepClass[0]?.workerId || ''
  );
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const allLaureates = [
    ...top3Sunday.map(l => ({ ...l, type: 'Sunday Morning Service' })),
    ...top3PrepClass.map(l => ({ ...l, type: 'Thursday Preparatory Class' }))
  ];

  const currentIndividual = allLaureates.find(l => l.workerId === selectedLaureateId) || allLaureates[0];

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCitationText = () => {
    let text = `THE GOSPEL FAITH MISSION INTERNATIONAL(HOUSE OF FAVOUR) (GOFAMINT_HOF)\nSUNDAY SCHOOL DEPARTMENT\n\n`;
    text += `OFFICIAL CITATION & ADMONITION ROLL OF HONOUR\n`;
    text += `Quarter: ${activeQuarter.quarterName} (12-Week Evaluation)\n`;
    text += `Evaluation Theme: "Redeeming the Time, for the Days are Evil" - Ephesians 5:16\n\n`;

    text += `==================================================\n`;
    text += `1. THURSDAY MINISTERIAL PREPARATORY CLASS LAUREATES\n`;
    text += `==================================================\n`;
    top3PrepClass.forEach((l, i) => {
      text += `Rank ${i + 1}: ${l.workerName} (${l.department})\n`;
      text += `Punctuality Rate: ${l.punctualityRate}% (${l.onTimeCount}/${l.attendedCount} sessions on-time)\n`;
      text += `Admonition Citation: "${l.admonitionCitation}"\n\n`;
    });

    text += `==================================================\n`;
    text += `2. SUNDAY MORNING SERVICE WORKERS LAUREATES\n`;
    text += `==================================================\n`;
    top3Sunday.forEach((l, i) => {
      text += `Rank ${i + 1}: ${l.workerName} (${l.department})\n`;
      text += `Punctuality Rate: ${l.punctualityRate}% (${l.onTimeCount}/${l.attendedCount} services on-time)\n`;
      text += `Admonition Citation: "${l.admonitionCitation}"\n\n`;
    });

    text += `Quarter Average Prep Punctuality: ${averagePrepPunctuality}%\n`;
    text += `Quarter Average Sunday Punctuality: ${averageSundayPunctuality}%\n\n`;
    text += `PASTORAL ADMONITION:\n"Therefore, my beloved brethren, be ye stedfast, unmoveable, always abounding in the work of the Lord, forasmuch as ye know that your labour is not in vain in the Lord." — 1 Corinthians 15:58\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        
        {/* Header Controls (Hidden on Print) */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-bold">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                Official Punctuality Admonition Citation
              </h2>
              <p className="text-xs text-amber-300/80 font-medium">
                {activeQuarter.quarterName} • GOFAMINT_HOF Sunday School
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-slate-800 p-1 rounded-xl flex items-center text-xs">
              <button
                onClick={() => setSelectedTab('FULL_CITATION')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  selectedTab === 'FULL_CITATION' 
                    ? 'bg-amber-400 text-slate-950 shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Full Roll of Honour
              </button>
              <button
                onClick={() => setSelectedTab('INDIVIDUAL_CERTIFICATE')}
                className={`px-3 py-1.5 rounded-lg font-bold transition ${
                  selectedTab === 'INDIVIDUAL_CERTIFICATE' 
                    ? 'bg-amber-400 text-slate-950 shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Individual Certificate
              </button>
            </div>

            <button
              onClick={handleCopyCitationText}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              title="Copy Citation Text"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Document</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Individual Laureate Selector (if in individual mode) */}
        {selectedTab === 'INDIVIDUAL_CERTIFICATE' && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
            <span className="font-bold text-amber-900">Select Laureate to generate Certificate:</span>
            <select
              value={selectedLaureateId}
              onChange={e => setSelectedLaureateId(e.target.value)}
              className="bg-white border border-amber-300 rounded-xl px-3 py-1.5 font-bold text-slate-900 text-xs focus:ring-2 focus:ring-amber-500 outline-hidden"
            >
              {allLaureates.map(l => (
                <option key={`${l.workerId}-${l.type}`} value={l.workerId}>
                  {l.rank === 1 ? '🥇 1st' : l.rank === 2 ? '🥈 2nd' : '🥉 3rd'} — {l.workerName} ({l.department} • {l.punctualityRate}% in {l.type})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 print:bg-white print:p-0">
          
          {selectedTab === 'FULL_CITATION' ? (
            /* FULL ROLL OF HONOUR CITATION SHEET */
            <div 
              ref={printRef}
              className="bg-white border-4 border-amber-500/60 rounded-3xl p-6 sm:p-10 shadow-lg text-slate-900 space-y-8 print:border-2 print:border-amber-600 print:shadow-none print:rounded-none print-container max-w-3xl mx-auto"
            >
              {/* Header Crest */}
              <div className="text-center space-y-2 border-b-2 border-amber-400/40 pb-6">
                <div className="inline-block px-3 py-1 bg-blue-900 text-amber-300 rounded-full text-[10px] font-black tracking-widest uppercase mb-1">
                  THE GOSPEL FAITH MISSION INTERNATIONAL(HOUSE OF FAVOUR)
                </div>
                <h1 className="text-2xl sm:text-3xl font-black font-['Cinzel',serif] tracking-wider text-blue-950 uppercase">
                  Punctuality Admonition Citation
                </h1>
                <p className="text-xs sm:text-sm font-bold text-amber-800 tracking-wide">
                  SUNDAY SCHOOL DEPARTMENT • {activeQuarter.quarterName.toUpperCase()} CITATION ROLL OF HONOUR
                </p>
                <div className="italic text-xs text-slate-600 max-w-lg mx-auto pt-1">
                  "Redeeming the time, because the days are evil." — Ephesians 5:16
                </div>
              </div>

              {/* Preamble */}
              <div className="text-xs text-slate-700 leading-relaxed text-justify bg-amber-50/60 border border-amber-200 rounded-2xl p-4">
                This official Citation of Commendation and Brotherly Admonition is formally inscribed in recognition of steadfast fidelity, sacred timekeeping, and unyielding devotion exhibited throughout the 12 weeks of <strong>{activeQuarter.quarterName}</strong>. Punctuality is the sacrifice of honour unto the Lord, setting an exemplary pattern for the flock of God.
              </div>

              {/* Section 1: Preparatory Class */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <BookOpen className="w-4 h-4 text-blue-900" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-blue-950">
                    1. Ministerial Preparatory Class Laureates (Thursday Study)
                  </h3>
                </div>

                {top3PrepClass.length === 0 ? (
                  <p className="text-xs italic text-slate-400">No preparatory class evaluations recorded for this quarter.</p>
                ) : (
                  <div className="space-y-3">
                    {top3PrepClass.map((worker, index) => (
                      <div 
                        key={worker.workerId}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center shrink-0">
                              {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}
                            </span>
                            <span className="font-black text-slate-900 text-sm">{worker.workerName}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md">
                              {worker.department}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 italic pl-8">
                            "{worker.admonitionCitation}"
                          </p>
                        </div>

                        <div className="text-right shrink-0 pl-8 sm:pl-0">
                          <div className="text-lg font-black font-mono text-blue-950">{worker.punctualityRate}%</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {worker.onTimeCount} of {worker.attendedCount} On-Time
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Sunday Morning Service */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Church className="w-4 h-4 text-emerald-800" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-emerald-950">
                    2. Sunday Morning Service Workforce Laureates
                  </h3>
                </div>

                {top3Sunday.length === 0 ? (
                  <p className="text-xs italic text-slate-400">No Sunday service evaluations recorded for this quarter.</p>
                ) : (
                  <div className="space-y-3">
                    {top3Sunday.map((worker, index) => (
                      <div 
                        key={worker.workerId}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                              {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'}
                            </span>
                            <span className="font-black text-slate-900 text-sm">{worker.workerName}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
                              {worker.department}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 italic pl-8">
                            "{worker.admonitionCitation}"
                          </p>
                        </div>

                        <div className="text-right shrink-0 pl-8 sm:pl-0">
                          <div className="text-lg font-black font-mono text-emerald-950">{worker.punctualityRate}%</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {worker.onTimeCount} of {worker.attendedCount} On-Time
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pastoral Exhortation & Blessing */}
              <div className="pt-4 border-t-2 border-dashed border-amber-300 text-center space-y-2">
                <div className="text-xs font-serif italic text-slate-800 max-w-xl mx-auto">
                  "Therefore, my beloved brethren, be ye stedfast, unmoveable, always abounding in the work of the Lord, forasmuch as ye know that your labour is not in vain in the Lord." — 1 Corinthians 15:58
                </div>
                <div className="grid grid-cols-2 gap-8 pt-8 text-xs font-bold text-slate-800">
                  <div className="text-center border-t border-slate-400 pt-2">
                    <span>Sunday School Superintendent</span>
                  </div>
                  <div className="text-center border-t border-slate-400 pt-2">
                    <span>Pastor / Minister in Charge</span>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* INDIVIDUAL LAUREATE COMMENDATION CERTIFICATE */
            <div 
              ref={printRef}
              className="bg-white border-8 border-double border-amber-500 rounded-3xl p-8 sm:p-12 shadow-xl text-slate-900 space-y-8 print:border-4 print:shadow-none print:rounded-none print-container max-w-2xl mx-auto text-center relative overflow-hidden"
            >
              {/* Background decorative watermark */}
              <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                <Trophy className="w-96 h-96 text-amber-500" />
              </div>

              <div className="space-y-3 relative z-10">
                <div className="inline-block px-4 py-1.5 bg-blue-950 text-amber-300 rounded-full text-xs font-black tracking-widest uppercase">
                  THE GOSPEL FAITH MISSION INTERNATIONAL(HOUSE OF FAVOUR)
                </div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  SUNDAY SCHOOL WORKFORCE HONOUR ROLL
                </div>
                <h1 className="text-3xl sm:text-4xl font-black font-['Cinzel',serif] text-blue-950 uppercase tracking-wide">
                  Certificate of Admonition & Honor
                </h1>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                  {activeQuarter.quarterName} • 12-WEEK PUNCTUALITY LAUREATE
                </p>
              </div>

              {currentIndividual ? (
                <div className="space-y-6 relative z-10">
                  <p className="text-xs text-slate-600 italic">
                    This distinguished citation is joyfully presented unto:
                  </p>

                  <div className="py-3 border-b-2 border-amber-400 inline-block px-8">
                    <h2 className="text-2xl sm:text-3xl font-black text-blue-950 font-serif">
                      {currentIndividual.workerName}
                    </h2>
                  </div>

                  <div className="text-xs font-bold text-slate-700">
                    <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full">
                      {currentIndividual.department} Department
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed max-w-lg mx-auto">
                    Having distinguished themselves in godly discipline, sacred diligence, and time consciousness throughout the 12 weeks with an exemplary punctuality rating of:
                  </p>

                  <div className="inline-flex items-center gap-3 bg-amber-50 border-2 border-amber-400 px-6 py-3 rounded-2xl">
                    <div className="text-3xl font-black text-amber-700 font-mono">
                      {currentIndividual.punctualityRate}%
                    </div>
                    <div className="text-left text-[11px] font-bold text-amber-950">
                      <div>{currentIndividual.type}</div>
                      <div className="text-amber-800 font-normal">{currentIndividual.onTimeCount} of {currentIndividual.attendedCount} Sessions On-Time</div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs italic text-slate-800 max-w-lg mx-auto">
                    "{currentIndividual.admonitionCitation}"
                  </div>

                  <div className="grid grid-cols-2 gap-12 pt-8 text-xs font-bold text-slate-800">
                    <div className="text-center border-t border-slate-400 pt-2">
                      <span>Sunday School Superintendent</span>
                    </div>
                    <div className="text-center border-t border-slate-400 pt-2">
                      <span>Pastor in Charge</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-slate-400 text-xs italic">
                  No laureate selected or available for this quarter.
                </div>
              )}
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
