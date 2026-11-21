import React, { useState, useEffect } from 'react';
import { 
  X, 
  Split, 
  Sparkles, 
  Loader2, 
  Check, 
  Clock, 
  ArrowLeft, 
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Task, DigitalTwinProfile } from '../types';
import { breakdownTaskWithAI, FRIENDLY_AI_CONNECTION_ERROR } from '../utils/api';
import { useModalScrollLock } from '../utils/modalCoordinator';
import confetti from 'canvas-confetti';

interface TaskBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task;
  profile: DigitalTwinProfile;
  onApplySubtasks: (taskId: string, subtasks: any[]) => void;
}

export const TaskBreakdownModal: React.FC<TaskBreakdownModalProps> = ({
  isOpen,
  onClose,
  task,
  profile,
  onApplySubtasks,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [breakdownData, setBreakdownData] = useState<{
    breakdownOverview: string;
    quickWinTip: string;
    subtasks: {
      title: string;
      estimatedMinutes: number;
      difficulty: 'easy' | 'medium' | 'hard';
      focusTip?: string;
    }[];
  } | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      handleBreakdown();
    } else {
      setBreakdownData(null);
      setErrorMsg(null);
    }
  }, [isOpen, task]);

  const handleBreakdown = async () => {
    if (!task) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await breakdownTaskWithAI({
        taskTitle: task.title,
        taskDescription: task.description,
        estimatedHours: `${task.estimatedMinutes || 60} دقيقة`,
        profile,
      });
      setBreakdownData(data);
    } catch (e) {
      console.error('[TaskBreakdownModal] breakdownTaskWithAI failed:', e);
      setErrorMsg(FRIENDLY_AI_CONNECTION_ERROR);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!task || !breakdownData) return;
    const formattedSubtasks = breakdownData.subtasks.map((st, idx) => ({
      id: `st-${Date.now()}-${idx}`,
      title: st.title,
      estimatedMinutes: st.estimatedMinutes,
      completed: false,
      focusTip: st.focusTip,
    }));

    onApplySubtasks(task.id, formattedSubtasks);
    confetti({ particleCount: 40, spread: 50 });
    onClose();
  };

  useModalScrollLock('breakdown-modal', Boolean(isOpen && task));

  if (!isOpen || !task) return null;

  return (
    <div
      className="app-modal-overlay bg-slate-950/85 backdrop-blur-md sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="app-modal-panel max-w-xl bg-gradient-to-b from-slate-900 via-[#0a0f1e] to-slate-950 border border-slate-800 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Always-Visible Close (X) */}
        <div className="app-modal-header p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-cyan-300 shadow-md shadow-cyan-500/20 shrink-0">
              <Split className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                تفكيك المهمة إلى خطوات تنفيذية
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                نسختك الرقمية تحول المهام المعقدة إلى خطوات صغيرة قابلة للإنجاز الفوري
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
          {/* Task Title Banner */}
          <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <span className="text-[11px] text-cyan-400 font-bold block mb-1">المهمة المستهدفة:</span>
            <h4 className="text-sm font-bold text-slate-100">{task.title}</h4>
            {task.description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="py-12 text-center space-y-3" role="status" aria-live="polite">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
              <p className="text-xs text-cyan-300 font-semibold animate-pulse">
                جاري التفكير...
              </p>
            </div>
          )}

          {/* Friendly Connection Error */}
          {!isLoading && errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-700/60 text-xs text-rose-100 flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{errorMsg}</span>
              </span>
              <button
                type="button"
                onClick={handleBreakdown}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          )}

          {/* Results */}
          {!isLoading && breakdownData && (
            <div className="space-y-3.5 animate-fadeIn">
              
              {/* Quick Win Advice */}
              <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-3.5 flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-amber-300">نصيحة التوأم لكسر التسويف:</span>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">{breakdownData.quickWinTip}</p>
                </div>
              </div>

              {/* Subtasks list */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300">الخطوات المقترحة:</span>
                
                {breakdownData.subtasks.map((st, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-200">{st.title}</p>
                        {st.focusTip && (
                          <p className="text-[11px] text-slate-400 mt-0.5">💡 {st.focusTip}</p>
                        )}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-cyan-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded shrink-0">
                      {st.estimatedMinutes} دقيقة
                    </span>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleApply}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>اعتماد وإضافة الخطوات للمهمة</span>
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
