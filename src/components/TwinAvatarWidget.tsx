import React from 'react';
import { 
  BrainCircuit, 
  Activity, 
  MessageSquare, 
  Sparkles, 
  ShieldCheck, 
  Zap,
  ArrowLeft,
  AlertTriangle,
  Coffee
} from 'lucide-react';
import { DigitalTwinProfile, Task } from '../types';
import { evaluateCognitiveLoad } from '../utils/burnoutEngine';

interface TwinAvatarWidgetProps {
  profile: DigitalTwinProfile;
  tasks: Task[];
  activeTask?: Task;
  completedTasksCount: number;
  totalTasksCount: number;
  onOpenChat: (initialPrompt?: string) => void;
  onOpenBriefing: (type: 'morning' | 'evening') => void;
  onNavigateToSchedule?: () => void;
}

export const TwinAvatarWidget: React.FC<TwinAvatarWidgetProps> = ({
  profile,
  tasks,
  completedTasksCount,
  totalTasksCount,
  onOpenChat,
  onNavigateToSchedule,
}) => {
  const completionPercentage = totalTasksCount > 0 
    ? Math.round((completedTasksCount / totalTasksCount) * 100) 
    : 0;

  const evaluation = evaluateCognitiveLoad(tasks);
  const highPriorityPendingCount = tasks.filter(
    (t) => t.priority === 'high' && t.status !== 'completed'
  ).length;

  let cognitiveLabel = 'مستقر وآمن';
  let cognitiveColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800';
  let progressBarColor = 'from-emerald-500 to-cyan-500';
  let cognitivePercentage = Math.min(48, Math.max(20, 20 + highPriorityPendingCount * 12));

  if (evaluation.isOverloaded) {
    cognitiveLabel = 'عبء معرفي مرتفع';
    cognitiveColor = 'text-rose-300 bg-rose-950/70 border-rose-700/80';
    progressBarColor = 'from-rose-500 to-amber-500';
    cognitivePercentage = Math.min(100, 75 + (highPriorityPendingCount - 3) * 6);
  } else if (highPriorityPendingCount === 3) {
    cognitiveLabel = 'جدول مكثف';
    cognitiveColor = 'text-amber-300 bg-amber-950/70 border-amber-700/80';
    progressBarColor = 'from-amber-500 to-orange-400';
    cognitivePercentage = 68;
  }

  const handleRecommendedAction = () => {
    if (evaluation.isOverloaded && onNavigateToSchedule) {
      onNavigateToSchedule();
      return;
    }
    if (highPriorityPendingCount === 3) {
      onOpenChat('جدولي اليومي مكثف (3 مهام عالية الأهمية). اقترح لي كيف أنظم أوقات الراحة القصيرة بين جلسات التركيز؟');
      return;
    }
    onOpenChat('حملي المعرفي مستقر اليوم، ما أفضل طريقة لاستثمار طاقتي بأقصى كفاءة؟');
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-950 rounded-2xl border border-slate-800/80 p-5 shadow-xl shadow-cyan-950/20 relative overflow-hidden">
      
      {/* Background subtle glowing radial */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none -ml-10 -mb-10" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Left Side: Avatar & Persona details */}
        <div className="flex items-start sm:items-center gap-4">
          
          {/* Avatar Hologram */}
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-violet-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center relative overflow-hidden">
                <BrainCircuit className="w-8 h-8 text-cyan-400 animate-soft-pulse" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/10 to-indigo-600/20 pointer-events-none" />
              </div>
            </div>
            
            {/* Live Status indicator */}
            <span className="absolute -bottom-1 -left-1 flex items-center gap-1 bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded-full text-[10px] text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              متزامن
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-100">
                توأم {profile.name || 'نبيل'} الرقمي
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-medium">
                {profile.role || 'مدير الإنتاجية'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-1 max-w-md line-clamp-1">
              🎯 الهدف الحالي: <span className="text-slate-200">{profile.mainGoals || 'تحقيق أقصى إنجاز يومي بتوازن'}</span>
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs">
              <div className="flex items-center gap-1 text-slate-300">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>الذروة: {profile.peakEnergy || 'صباحاً'}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>الأسلوب: {profile.workStyle || 'تركيز عميق'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Mental Load & Quick Twin Triggers */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 border-t md:border-t-0 md:border-r border-slate-800 pt-4 md:pt-0 md:pr-6">
          
          {/* Cognitive & Energy metrics */}
          <div className="min-w-[200px] max-w-[260px] space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                الحمل المعرفي
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded border font-semibold ${cognitiveColor}`}>
                {cognitiveLabel} ({highPriorityPendingCount} هامة)
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${progressBarColor} rounded-full transition-all duration-500`}
                style={{ width: `${cognitivePercentage}%` }}
              />
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {evaluation.message}
            </p>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
              <span>إنجاز المهام:</span>
              <span className="font-semibold text-cyan-300">{completedTasksCount} من {totalTasksCount} ({completionPercentage}%)</span>
            </div>
          </div>

          {/* Quick Twin Consultation Prompts */}
          <div className="flex flex-col gap-1.5">
            <button
              id="btn-twin-recommended-action"
              onClick={handleRecommendedAction}
              className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all group cursor-pointer ${
                evaluation.isOverloaded
                  ? 'bg-rose-950/70 hover:bg-rose-900/80 text-rose-200 border-rose-700/80'
                  : highPriorityPendingCount === 3
                  ? 'bg-amber-950/60 hover:bg-amber-900/70 text-amber-200 border-amber-700/80'
                  : 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-200 border-emerald-800/70'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {evaluation.isOverloaded ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                ) : highPriorityPendingCount === 3 ? (
                  <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
                <span className="truncate max-w-[185px]">{evaluation.recommendedAction}</span>
              </span>
              <ArrowLeft className="w-3.5 h-3.5 opacity-70 group-hover:-translate-x-0.5 transition-all shrink-0" />
            </button>

            <button
              id="btn-twin-ask-start"
              onClick={() => onOpenChat('ما هي الخطوة الأكثر تأثيراً التي يجب أن أبدأ بها الآن بناءً على طاقتي وجدولي؟')}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 text-xs font-medium transition-all group cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                ماذا أبدأ به الآن؟
              </span>
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:-translate-x-0.5 transition-all" />
            </button>

            <button
              id="btn-twin-ask-overwhelmed"
              onClick={() => onOpenChat('أشعر ببعض التشتت والإرهاق، كيف يمكننا إعادة ترتيب ما تبقى من اليوم بطريقة واقعية؟')}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 border border-slate-700/80 text-xs font-medium transition-all group cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                استشارة لتقليل التشتت
              </span>
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:-translate-x-0.5 transition-all" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
