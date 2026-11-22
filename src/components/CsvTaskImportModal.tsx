import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { Task, TaskTag } from '../types';
import { useModalScrollLock } from '../utils/modalCoordinator';
import {
  autoDetectCsvMapping,
  buildTasksFromCsv,
  CSV_TARGET_FIELD_META,
  CsvColumnMapping,
  CsvTargetField,
  exportTasksToCsv,
  generateSampleTasksCsv,
  MAX_CSV_FILE_BYTES,
  MAX_CSV_IMPORT_ROWS,
  parseCsvText,
} from '../utils/csvTaskImporter';
import { getTagStyleForName } from '../utils/taskTags';
import confetti from 'canvas-confetti';

interface CsvTaskImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTasks: Task[];
  customTags: TaskTag[];
  onImportTasks: (
    importedTasks: Partial<Task>[],
    options: { autoCreateTags: boolean; discoveredTags: string[] }
  ) => void;
}

export const CsvTaskImportModal: React.FC<CsvTaskImportModalProps> = ({
  isOpen,
  onClose,
  existingTasks,
  customTags,
  onImportTasks,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawCsvText, setRawCsvText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [autoCreateTags, setAutoCreateTags] = useState(true);
  const [mappingOverrides, setMappingOverrides] = useState<Partial<CsvColumnMapping>>({});

  useModalScrollLock('csv-import-modal', isOpen);

  const parsedCsv = useMemo(() => parseCsvText(rawCsvText), [rawCsvText]);

  const effectiveMapping = useMemo<CsvColumnMapping>(() => {
    const auto = autoDetectCsvMapping(parsedCsv.headers);
    return {
      ...auto,
      ...mappingOverrides,
    };
  }, [parsedCsv.headers, mappingOverrides]);

  const previewResult = useMemo(
    () =>
      buildTasksFromCsv(parsedCsv, effectiveMapping, existingTasks, {
        skipDuplicates,
      }),
    [parsedCsv, effectiveMapping, existingTasks, skipDuplicates]
  );

  if (!isOpen) return null;

  const loadCsvContent = (content: string, name: string | null) => {
    setErrorMsg(null);
    setMappingOverrides({});
    const parsed = parseCsvText(content);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      setErrorMsg('الملف لا يحتوي على صفوف بيانات صالحة للاستيراد.');
    }
    setRawCsvText(content);
    setFileName(name);
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_CSV_FILE_BYTES) {
      setErrorMsg('حجم الملف يتجاوز الحد المسموح (2 ميجابايت). يرجى تقسيم الملف والمحاولة مرة أخرى.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = typeof ev.target?.result === 'string' ? ev.target.result : '';
      loadCsvContent(content, file.name);
    };
    reader.onerror = () => {
      setErrorMsg('تعذر قراءة الملف المحدد. تأكد من أنه ملف نصي أو CSV بترميز UTF-8.');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDownloadSample = () => {
    const csv = generateSampleTasksCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'قالب-استيراد-المهام.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCurrentCsv = () => {
    const csv = exportTasksToCsv(existingTasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFieldMapChange = (field: CsvTargetField, rawValue: string) => {
    setMappingOverrides((prev) => ({
      ...prev,
      [field]: rawValue === '' ? null : Number(rawValue),
    }));
  };

  const handleConfirmImport = () => {
    if (effectiveMapping.title === null) {
      setErrorMsg('يرجى تحديد العمود الذي يمثل «عنوان المهمة».');
      return;
    }
    if (previewResult.tasks.length === 0) {
      setErrorMsg('لا توجد مهام صالحة للاستيراد بعد تطبيق التصفية الحالية.');
      return;
    }

    onImportTasks(previewResult.tasks, {
      autoCreateTags,
      discoveredTags: previewResult.discoveredTags,
    });
    confetti({ particleCount: 55, spread: 70 });
    setRawCsvText('');
    setFileName(null);
    setMappingOverrides({});
    setErrorMsg(null);
    onClose();
  };

  const handleResetModal = () => {
    setRawCsvText('');
    setFileName(null);
    setMappingOverrides({});
    setErrorMsg(null);
  };

  const priorityLabel = (p?: string) =>
    p === 'high' ? 'عالية' : p === 'low' ? 'منخفضة' : 'متوسطة';

  const categoryLabel = (c?: string) => {
    if (c === 'urgent') return 'طارئ';
    if (c === 'health') return 'صحة';
    if (c === 'study') return 'دراسة';
    if (c === 'personal') return 'شخصي';
    return 'عمل';
  };

  return (
    <div
      className="app-modal-overlay bg-slate-950/85 backdrop-blur-md sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="app-modal-panel max-w-3xl bg-gradient-to-b from-slate-900 via-[#0b101e] to-slate-950 border border-slate-800 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="app-modal-header p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                استيراد المهام من ملف CSV
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                انقل مهامك بسهولة من Todoist أو TickTick أو Notion أو Excel وجداول Google
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="app-modal-close p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="app-modal-body p-4 sm:p-5 space-y-4">
          {/* Quick Template & Export Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>يدعم الفواصل ( , أو ; ) والنصوص العربية والأعمدة التلقائية</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSample}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-semibold transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل قالب CSV</span>
              </button>
              {existingTasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportCurrentCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-semibold transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير مهامي CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* File Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              handleFileSelected(file);
            }}
            className={`rounded-2xl border-2 border-dashed p-5 text-center transition-all ${
              isDragging
                ? 'border-cyan-400 bg-cyan-950/30'
                : 'border-slate-700/80 bg-slate-950/60 hover:border-cyan-500/60'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,.txt,text/plain"
              className="hidden"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            <div className="flex flex-col items-center gap-2.5">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-cyan-400">
                <Upload className="w-5 h-5" />
              </div>

              {fileName ? (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تم تحميل الملف: {fileName}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    تم اكتشاف {parsedCsv.headers.length} أعمدة و {parsedCsv.rows.length} صفوف
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-200">
                    اسحب ملف CSV وأفلته هنا، أو اضغط لاختيار ملف من جهازك
                  </p>
                  <p className="text-[11px] text-slate-400">
                    بحد أقصى {MAX_CSV_IMPORT_ROWS} مهمة في العملية الواحدة (2 ميجابايت)
                  </p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  id="btn-select-csv-file"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
                >
                  {fileName ? 'اختيار ملف آخر' : 'اختيار ملف CSV'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasteBox((v) => !v)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{showPasteBox ? 'إخفاء اللصق اليدوي' : 'لصق نص CSV يدوياً'}</span>
                  </span>
                </button>
                {rawCsvText && (
                  <button
                    type="button"
                    onClick={handleResetModal}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs font-semibold transition-all cursor-pointer"
                  >
                    مسح
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Optional Direct CSV Paste */}
          {showPasteBox && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="text-xs font-semibold text-slate-300">
                الصق محتوى CSV مباشرة هنا:
              </label>
              <textarea
                rows={4}
                value={rawCsvText}
                onChange={(e) => {
                  setErrorMsg(null);
                  setMappingOverrides({});
                  setFileName(null);
                  setRawCsvText(e.target.value);
                }}
                placeholder={'العنوان,الأولوية,التصنيف,تاريخ الاستحقاق,الوسوم\nمراجعة التقرير,عالية,عمل,2026-11-23,"عمل,عاجل"'}
                className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none resize-y"
              />
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200 flex items-center gap-2 font-semibold"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Column Mapping & Preview */}
          {parsedCsv.headers.length > 0 && parsedCsv.rows.length > 0 && (
            <div className="space-y-4 animate-fadeIn">
              {/* Mapping Grid */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-100">
                    ربط أعمدة الملف بحقول المهام (تم التعرف تلقائياً)
                  </h4>
                  <span className="text-[11px] text-cyan-300 font-semibold">
                    الفاصل المكتشف: {parsedCsv.delimiter === '\t' ? 'Tab' : parsedCsv.delimiter}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {CSV_TARGET_FIELD_META.map((field) => {
                    const selectedIdx = effectiveMapping[field.key];
                    return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                          <span>{field.label}</span>
                          {field.required && <span className="text-rose-400">*</span>}
                        </label>
                        <select
                          value={selectedIdx === null ? '' : String(selectedIdx)}
                          onChange={(e) => handleFieldMapChange(field.key, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                        >
                          <option value="">-- تجاهل هذا الحقل --</option>
                          {parsedCsv.headers.map((header, idx) => (
                            <option key={`${header}-${idx}`} value={String(idx)}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                {/* Options */}
                <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-cyan-500"
                    />
                    <span>تخطي المهام المكررة (بنفس العنوان)</span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoCreateTags}
                      onChange={(e) => setAutoCreateTags(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500"
                    />
                    <span>إضافة الوسوم الجديدة تلقائياً لقائمة التصنيفات</span>
                  </label>
                </div>
              </div>

              {/* Preview Summary & Sample Rows */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-emerald-300">
                    معاينة المهام الجاهزة للاستيراد ({previewResult.tasks.length} مهمة)
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {previewResult.skippedDuplicateCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-800/50 text-amber-300">
                        مكررة تم تخطيها: {previewResult.skippedDuplicateCount}
                      </span>
                    )}
                    {previewResult.skippedEmptyTitleCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                        صفوف بدون عنوان: {previewResult.skippedEmptyTitleCount}
                      </span>
                    )}
                    {previewResult.truncatedByLimitCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/50 text-rose-300">
                        تم الاقتصار على أول {MAX_CSV_IMPORT_ROWS} صف
                      </span>
                    )}
                  </div>
                </div>

                {previewResult.tasks.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    لا توجد مهام مطابقة للاستيراد. تأكد من ربط عمود «عنوان المهمة» أو إلغاء تخطي المكررات.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {previewResult.tasks.slice(0, 8).map((task, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-semibold text-slate-100 truncate ${
                              task.status === 'completed' ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {task.title}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                              {categoryLabel(task.category)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded border ${
                                task.priority === 'high'
                                  ? 'bg-rose-950/70 text-rose-300 border-rose-800/60'
                                  : task.priority === 'low'
                                  ? 'bg-slate-800 text-slate-300 border-slate-700'
                                  : 'bg-amber-950/70 text-amber-300 border-amber-800/60'
                              }`}
                            >
                              {priorityLabel(task.priority)}
                            </span>
                            {task.dueDate && (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                                {task.dueDate}
                                {task.dueTime ? ` ${task.dueTime}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {task.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">
                            {task.description}
                          </p>
                        )}

                        {task.tags && task.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {task.tags.map((tagName) => {
                              const style = getTagStyleForName(tagName, customTags);
                              return (
                                <span
                                  key={tagName}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${style.badgeClass}`}
                                >
                                  <Tag className="w-2.5 h-2.5" />
                                  <span>{tagName}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}

                    {previewResult.tasks.length > 8 && (
                      <p className="text-[11px] text-center text-slate-400 pt-1">
                        + {previewResult.tasks.length - 8} مهمة إضافية سيتم استيرادها
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Import Button */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  id="btn-confirm-csv-import"
                  disabled={previewResult.tasks.length === 0 || effectiveMapping.title === null}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>استيراد {previewResult.tasks.length} مهمة الآن</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
