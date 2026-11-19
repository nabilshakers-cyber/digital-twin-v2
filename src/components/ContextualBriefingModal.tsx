import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  Zap,
  Flame,
  Split,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import {
  Task,
  DigitalTwinProfile,
  TimeBlock,
  LongTermGoal,
  ContextualBriefing,
} from '../types';
import { generateContextualBriefingWithAI } from '../utils/api';

interface ContextualBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task;
  profile: DigitalTwinProfile;
  schedule: TimeBlock[];
  goals: LongTermGoal[];
  cachedBriefing?: ContextualBriefing;
  onSaveBriefing: (briefing: ContextualBriefing) => void;
  onStartFocus: (task: Task) => void;
  onOpenBreakdown: (task: Task) => void;
}

export const ContextualBriefingModal: React.FC<ContextualBriefingModalProps> = ({
  isOpen,
  onClose,
  task,
  profile,
  schedule,
  goals,
  cachedBriefing,
  onSaveBriefing,
  onStartFocus,
  onOpenBreakdown,
}) => {
  const [briefing, setBriefing] = useState<ContextualBriefing | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !task) {
      setBriefing(null);
      setError(null);
      return;
    }

    if (cachedBriefing && cachedBriefing.taskId === task.id) {
      setBriefing(cachedBriefing);
      setError(null);
    } else {
      fetchBriefing();
    }
  }, [isOpen, task?.id]);

  const fetchBriefing = async () => {
    if (!task) return;
    setIsLoading(true);
    setError(null);

    try {
      const data = await generateContextualBriefingWithAI({
        task,
        profile,
        schedule,
        goals,
      });
      setBriefing(data);
      onSaveBriefing(data);
    } catch (err: any) {
      setError(err.message || 'تعذر توليد الموجز السياقي للمهمة');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-[#0a1020] to-slate-950 border border-slate-800 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Always-Visible Close (X) */}
        <div className="shrink-0 sticky top-0 z-20 p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                الموجز السياقي للمهمة (Contextual Briefing)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                تحضير ذكي يربط هذه المهمة بأهدافك وجدولك قبل الانطلاق
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="shrink-0 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
          {/* Target Task Card */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-cyan-400 block mb-0.5">
                المهمة المستهدفة:
              </span>
              <h4 className="text-sm font-bold text-slate-100">{task.title}</h4>
              {task.description && (
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>
              )}
            </div>

            <button
              type="button"
              onClick={fetchBriefing}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-800 shrink-0 cursor-pointer disabled:opacity-40"
              title="تحديث الموجز السياقي"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
              <p className="text-xs text-slate-300 font-semibold">
                نسختك الرقمية تقرأ السياق وتربط المهمة بأهدافك...
              </p>
            </div>
          )}

          {/* Error */}
          {!isLoading && error && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-200 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={fetchBriefing}
                className="px-3 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-semibold cursor-pointer"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {/* Briefing Result */}
          {!isLoading && briefing && (
            <div className="space-y-4 animate-fadeIn">
              {/* Summary */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 to-indigo-950/30 border border-indigo-800/50 space-y-1.5">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  الخلاصة السياقية:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {briefing.summary}
                </p>
              </div>

              {/* Key Notes */}
              {briefing.keyNotes && briefing.keyNotes.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                    ملاحظات مرجعية حاسمة:
                  </span>
                  <div className="space-y-1.5">
                    {briefing.keyNotes.map((note, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 text-xs text-slate-200"
                      >
                        <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Immediate Action */}
              <div className="p-3.5 rounded-2xl bg-amber-950/25 border border-amber-800/50 space-y-1">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  الخطوة المقترحة للبدء فوراً:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                  {briefing.suggestedAction}
                </p>
              </div>

              {/* Action Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBreakdown(task);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold cursor-pointer"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>تفكيك الخطوات</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onStartFocus(task);
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Flame className="w-4 h-4" />
                  <span>بدء جلسة التركيز الآن</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
