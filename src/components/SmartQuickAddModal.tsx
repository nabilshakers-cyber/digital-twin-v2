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
  MicOff
} from 'lucide-react';
import { Task, TimeBlock } from '../types';
import { parseQuickEntryWithAI } from '../utils/api';
import { useWebSpeech } from '../hooks/useWebSpeech';
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
      setNaturalText((prev) => (prev ? `${prev} ${finalText}` : finalText));
    },
  });

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!naturalText.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const result = await parseQuickEntryWithAI({
        naturalText: naturalText.trim(),
        currentDate: new Date().toISOString(),
      });
      setExtractedResult(result);
    } catch (e) {
      console.error(e);
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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-xl bg-gradient-to-b from-slate-900 via-[#0b101e] to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-4">
        
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              الإدخال الذكي باللغة الطبيعية
            </h3>
            <p className="text-xs text-slate-400">
              اكتب أفكارك أو جدولك اليومي كما يخطر ببالك، وسيقوم التوأم بفرزها إلى مهام ومواعيد
            </p>
          </div>
        </div>

        {/* Input Textarea */}
        <div className="space-y-2">
          <textarea
            rows={3}
            value={isSpeechListening && speechInterim ? `${naturalText} ${speechInterim}`.trim() : naturalText}
            onChange={(e) => setNaturalText(e.target.value)}
            placeholder="مثال: غداً عندي اجتماع مع الفريق الساعة 10:30 صباحاً، وكتابة تقرير المبيعات لمدة ساعة، وممارسة رياضة المشي بعد المغرب..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none transition-colors"
          />

          {speechError && (
            <p className="text-[11px] text-rose-300 bg-rose-950/50 border border-rose-800/60 px-2.5 py-1.5 rounded-lg">
              {speechError}
            </p>
          )}

          <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={() => (isSpeechListening ? stopSpeechListening() : startSpeechListening())}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
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
            <button
              onClick={handleParse}
              disabled={!naturalText.trim() || isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>جاري التحليل...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>تحليل واستخراج ذكي</span>
                </>
              )}
            </button>
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
  );
};
