import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Loader2, 
  Check, 
  Calendar, 
  CheckSquare, 
  Clock, 
  ArrowRight,
  Send,
  Mic,
  MicOff,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Task, TimeBlock } from '../types';
import { FRIENDLY_AI_CONNECTION_ERROR, parseQuickEntryWithAI } from '../utils/api';
import { useWebSpeech } from '../hooks/useWebSpeech';
import { useModalScrollLock } from '../utils/modalCoordinator';
import confetti from 'canvas-confetti';

interface SmartQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExtracted: (tasks: Partial<Task>[], events: Partial<TimeBlock>[]) => void;
}

export const SmartQuickAddModal: React.FC<SmartQuickAddModalProps> = ({
  isOpen,
  onClose,
  onAddExtracted,
}) => {
  const [naturalText, setNaturalText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<{
    extractedTasks: Partial<Task>[];
    extractedEvents: Partial<TimeBlock>[];
    twinComment: string;
  } | null>(null);

  const {
    isSupported: isSpeechSupported,
    isListening: isSpeechListening,
    interimTranscript: speechInterim,
    error: speechError,
    startListening: startSpeechListening,
    stopListening: stopSpeechListening,
  } = useWebSpeech({
    lang: 'ar-SA',
    continuous: false,
    onFinalTranscript: (finalText) => {
      setValidationError(null);
      setErrorMsg(null);
      setNaturalText((prev) => (prev ? `${prev} ${finalText}` : finalText));
    },
  });

  useModalScrollLock('quick-add-modal', isOpen);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (isLoading) return;
    if (!naturalText.trim()) {
      setValidationError('يرجى كتابة عنوان المهمة أولاً.');
      return;
    }

    setValidationError(null);
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const result = await parseQuickEntryWithAI({
        naturalText: naturalText.trim(),
        currentDate: new Date().toISOString(),
      });
      setExtractedResult(result);
    } catch (e) {
      console.error('[SmartQuickAddModal] parseQuickEntryWithAI failed:', e);
      setErrorMsg(FRIENDLY_AI_CONNECTION_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAdd = () => {
    if (!extractedResult) return;
    onAddExtracted(extractedResult.extractedTasks, extractedResult.extractedEvents);
    confetti({ particleCount: 50, spread: 60 });
    onClose();
    setExtractedResult(null);
    setNaturalText('');
  };

  return (
    <div
      className="app-modal-overlay bg-slate-950/85 backdrop-blur-md sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="app-modal-panel max-w-xl bg-gradient-to-b from-slate-900 via-[#0b101e] to-slate-950 border border-slate-800 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Always-Visible Close (X) */}
        <div className="app-modal-header p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 shrink-0">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                الإدخال الذكي باللغة الطبيعية
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                اكتب أفكارك أو جدولك وسيقوم التوأم بفرزها إلى مهام ومواعيد
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

        {/* Scrollable Content */}
        <div className="app-modal-body p-4 sm:p-5 space-y-4">
          {/* Input Textarea */}
          <div className="space-y-2">
            <textarea
              rows={3}
              value={isSpeechListening && speechInterim ? `${naturalText} ${speechInterim}`.trim() : naturalText}
              onChange={(e) => {
                setNaturalText(e.target.value);
                if (validationError && e.target.value.trim()) setValidationError(null);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="مثال: غداً عندي اجتماع مع الفريق الساعة 10:30 صباحاً، وكتابة تقرير المبيعات لمدة ساعة، وممارسة رياضة المشي بعد المغرب..."
              className={`w-full bg-slate-950 border rounded-2xl p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none resize-none transition-colors ${
                validationError
                  ? 'border-rose-500/80 focus:border-rose-400'
                  : 'border-slate-800 focus:border-cyan-500'
              }`}
            />

            {validationError && (
              <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-700/60 px-3 py-2 rounded-xl flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{validationError}</span>
              </p>
            )}

            {speechError && (
              <p className="text-[11px] text-rose-300 bg-rose-950/50 border border-rose-800/60 px-2.5 py-1.5 rounded-lg">
                {speechError}
              </p>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-700/60 text-xs text-rose-100 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{errorMsg}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleParse()}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                {isSpeechSupported && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => (isSpeechListening ? stopSpeechListening() : startSpeechListening())}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 ${
                      isSpeechListening
                        ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-cyan-300'
                    }`}
                  >
                    {isSpeechListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isSpeechListening ? 'إيقاف الإملاء' : 'إملاء صوتي'}</span>
                  </button>
                )}
                <span>يمكنك كتابة أو إملاء عدة مهام ومواعيد دفعة واحدة</span>
              </div>
              {isLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-950/70 border border-cyan-700/60 text-cyan-300 font-bold"
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="animate-pulse">جاري التفكير...</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleParse}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>تحليل واستخراج ذكي</span>
                </button>
              )}
            </div>
          </div>

          {/* Extracted Preview */}
          {extractedResult && (
            <div className="bg-slate-950/80 rounded-2xl border border-cyan-900/50 p-4 space-y-3 animate-fadeIn">
              
              {/* Twin Comment */}
              {extractedResult.twinComment && (
                <div className="text-xs text-cyan-300 bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-800/40 font-medium">
                  💬 {extractedResult.twinComment}
                </div>
              )}

              {/* Extracted Tasks */}
              {extractedResult.extractedTasks?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                    المهام المستخرجة ({extractedResult.extractedTasks.length}):
                  </span>
                  <div className="space-y-1">
                    {extractedResult.extractedTasks.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <span className="text-slate-200 font-medium">{t.title}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                          {t.estimatedMinutes || 30} د • {t.priority || 'medium'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Events */}
              {extractedResult.extractedEvents?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    المواعيد والبلوكات الزمنية ({extractedResult.extractedEvents.length}):
                  </span>
                  <div className="space-y-1">
                    {extractedResult.extractedEvents.map((e, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <span className="text-slate-200 font-medium">{e.title}</span>
                        <span className="text-[10px] font-mono text-cyan-300 bg-slate-800 px-2 py-0.5 rounded">
                          {e.startTime} - {e.endTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Confirm button */}
              <div className="flex justify-end pt-2 border-t border-slate-800">
                <button
                  onClick={handleConfirmAdd}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>إدراج كافة المهام والمواعيد في النظام</span>
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
