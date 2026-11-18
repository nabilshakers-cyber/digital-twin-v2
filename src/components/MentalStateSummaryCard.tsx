import React from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Flame,
  MessageSquare,
  Play,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { DigitalTwinProfile, Task } from '../types';
import { evaluateTaskUrgency } from '../utils/reminderEngine';

interface MentalStateSummaryCardProps {
  profile: DigitalTwinProfile;
  tasks: Task[];
  onStartFocus?: (task?: Task) => void;
  onOpenChat?: (initialPrompt?: string) => void;
  onNavigateTasks?: () => void;
}

const getPersonalizedEncouragement = (
  profile: DigitalTwinProfile,
  completionRate: number,
  overdueCount: number,
  targetRate: number
): string => {
  const userName = profile.name || 'صديقي';
  const peak = profile.peakEnergy || 'ساعات ذروتك';
  const style = profile.workStyle || 'جلسات التركيز المتوازنة';
  const isAhead = completionRate >= targetRate && overdueCount === 0;
  const hasPressure = overdueCount > 0;

  switch (profile.tone) {
    case 'disciplined':
      if (hasPressure) {
        return `يا ${userName}، الانضباط يعني مواجهة المهام المتأخرة فوراً دون تأجيل — استثمر ${peak} لحسمها واحدة تلو الأخرى.`;
      }
      if (isAhead) {
        return `انضباط ممتاز يا ${userName}! حافظت على وتيرة ${completionRate}% وتجاوزت هدفك (${targetRate}%) — واصل بهذا الثبات.`;
      }
      return `يا ${userName}، التزم بأسلوبك (${style}) وأنجز المهمة الأثقل الآن قبل أي تشتيت.`;

    case 'encouraging':
      if (hasPressure) {
        return `أنت قادر على تجاوز هذا الضغط يا ${userName}! مهمة واحدة تنجزها الآن ستعيد إليك الحماس وتكسر حاجز التأخير.`;
      }
      if (isAhead) {
        return `عمل رائع ومُلهم يا ${userName}! صفاء ذهنك وإنجازك (${completionRate}%) يثبتان أنك في يومك الذهبي.`;
      }
      return `انطلاقة طيبة يا ${userName}! استفد من طاقتك في ${peak} ومع كل خطوة ستقترب من هدفك (${targetRate}%).`;

    case 'analytical':
      if (hasPressure) {
        return `مؤشر التوأم لـ ${userName}: لديك ${overdueCount} مهام متجاوزة للموعد ومعدل إنجاز ${completionRate}%؛ تصفيتها سترفع كفاءة يومك مباشرة.`;
      }
      if (isAhead) {
        return `القراءة التحليلية ممتازة يا ${userName}: معدل الإنجاز (${completionRate}%) يتفوق على معيارك المستهدف (${targetRate}%) بصفر تأخيرات.`;
      }
      return `تحليل الأداء لـ ${userName}: المعدل الحالي ${completionRate}% والمستهدف ${targetRate}% — تطبيق (${style}) سيغلق الفجوة بكفاءة.`;

    case 'calm':
      if (hasPressure) {
        return `بهدوء ورويّة يا ${userName}، لا تنظر لتراكم المهام دفعة واحدة؛ اختر مهمة واحدة فقط وتنفّس بعمق ثم ابدأ.`;
      }
      if (isAhead) {
        return `سكينة وإنجاز متوازن يا ${userName}، أتممت ${completionRate}% بهدوء تام وبدون أي ضغوط متأخرة.`;
      }
      return `خذ إيقاعك الهادئ يا ${userName} وفق (${style})، فالاستمرارية الهادئة أبقى أثراً من العجلة.`;

    case 'humorous':
      if (hasPressure) {
        return `يا ${userName}، المهام المتأخرة تنتظر دورها بنظرة عتاب! لنقتنص أولها خلال ${peak} قبل أن تتضاعف!`;
      }
      if (isAhead) {
        return `ما شاء الله يا ${userName}! بهذه السرعة (${completionRate}%) سيشعر جدولك بالغبطة وتأخذ راحتك مبكراً اليوم.`;
      }
      return `أهلاً يا ${userName}، الذهن صافٍ والميدان خالٍ من المتأخرات — شغّل وضع (${style}) ولننطلق!`;

    default:
      return `يا ${userName}، حافظ على توازنك واستثمر ${peak} لتحقيق هدفك اليومي (${targetRate}%).`;
  }
};

export const MentalStateSummaryCard: React.FC<MentalStateSummaryCardProps> = ({
  profile,
  tasks,
  onStartFocus,
  onOpenChat,
  onNavigateTasks,
}) => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const overdueTasks = pendingTasks.filter(
    (t) => evaluateTaskUrgency(t)?.urgency === 'overdue'
  );

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 100;
  const targetRate = profile.weeklyCompletionGoalRate ?? 85;
  const overdueCount = overdueTasks.length;

  // Determine dynamic mental state tier
  let stateLabel = 'جاهزية للانطلاق';
  let headline = 'ذهن صافٍ ومستعد لإنجاز الأولويات';
  let statusDescription = `معدل الإنجاز ${completionRate}% ولا توجد مهام متأخرة حالياً.`;
  let themeClasses =
    'from-indigo-950/60 via-slate-900 to-slate-900 border-indigo-500/35 shadow-indigo-500/10';
  let badgeClasses = 'bg-indigo-500/15 border-indigo-400/40 text-indigo-300';
  let iconBoxClasses = 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300';
  let barColorClass = 'from-indigo-500 to-cyan-400';
  let StateIcon = Brain;

  if (overdueCount >= 2 || (overdueCount >= 1 && completionRate < 40)) {
    stateLabel = 'تشتت وضغط متراكم';
    headline = 'الحالة الذهنية تحتاج إلى تفريغ الضغط الآن';
    statusDescription = `يوجد ${overdueCount} مهام متأخرة عن موعدها بينما نسبة الإنجاز ${completionRate}%.`;
    themeClasses =
      'from-rose-950/50 via-slate-900 to-amber-950/30 border-rose-500/40 shadow-rose-500/10';
    badgeClasses = 'bg-rose-500/15 border-rose-400/40 text-rose-300';
    iconBoxClasses = 'bg-rose-500/20 border-rose-400/40 text-rose-300';
    barColorClass = 'from-rose-500 to-amber-400';
    StateIcon = AlertTriangle;
  } else if (overdueCount === 1) {
    stateLabel = 'تنبيه تركيز طفيف';
    headline = 'أداء متوازن مع مهمة متأخرة تحتاج حسماً';
    statusDescription = `المهمة "${overdueTasks[0].title}" متأخرة، ونسبة الإنجاز الحالية ${completionRate}%.`;
    themeClasses =
      'from-amber-950/45 via-slate-900 to-slate-900 border-amber-500/40 shadow-amber-500/10';
    badgeClasses = 'bg-amber-500/15 border-amber-400/40 text-amber-300';
    iconBoxClasses = 'bg-amber-500/20 border-amber-400/40 text-amber-300';
    barColorClass = 'from-amber-500 to-yellow-400';
    StateIcon = Flame;
  } else if (completionRate >= targetRate) {
    stateLabel = 'ذروة التدفق الذهني';
    headline = 'ذهن متقد وإنجاز متفوق بلا أي تأخير';
    statusDescription = `حققت ${completionRate}% وتجاوزت هدفك الشخصي (${targetRate}%) بدون مهام متأخرة.`;
    themeClasses =
      'from-emerald-950/55 via-slate-900 to-cyan-950/30 border-emerald-500/40 shadow-emerald-500/10';
    badgeClasses = 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300';
    iconBoxClasses = 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300';
    barColorClass = 'from-emerald-500 to-cyan-400';
    StateIcon = Sparkles;
  } else if (completionRate >= 50) {
    stateLabel = 'صفاء واتزان ذهني';
    headline = 'وتيرة مستقرة وتقدم ملموس في المهام';
    statusDescription = `أنجزت ${completionRate}% من مهامك مع خلو القائمة من المهام المتأخرة.`;
    themeClasses =
      'from-cyan-950/50 via-slate-900 to-slate-900 border-cyan-500/35 shadow-cyan-500/10';
    badgeClasses = 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300';
    iconBoxClasses = 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300';
    barColorClass = 'from-cyan-500 to-emerald-400';
    StateIcon = TrendingUp;
  }

  const personalizedMessage = getPersonalizedEncouragement(
    profile,
    completionRate,
    overdueCount,
    targetRate
  );

  const priorityTargetTask = overdueTasks[0] || pendingTasks[0];

  return (
    <section
      id="mental-state-summary-card"
      aria-label="ملخص الحالة الذهنية"
      className={`rounded-2xl border bg-gradient-to-l ${themeClasses} p-5 shadow-xl transition-all duration-300 space-y-4`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${iconBoxClasses}`}
          >
            <StateIcon className="w-6 h-6" />
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">
                ملخص الحالة الذهنية
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${badgeClasses}`}
              >
                {stateLabel}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-extrabold text-white">
              {headline}
            </h2>

            <p className="text-xs text-slate-300">{statusDescription}</p>
          </div>
        </div>

        {/* Metrics Pills */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-center min-w-[92px]">
            <span className="block text-[10px] text-slate-400">نسبة الإنجاز</span>
            <span className="text-sm font-black font-mono text-cyan-300">
              {completionRate}%
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-center min-w-[92px]">
            <span className="block text-[10px] text-slate-400">مهام متأخرة</span>
            <span
              className={`text-sm font-black font-mono ${
                overdueCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {overdueCount}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2 text-center min-w-[92px]">
            <span className="block text-[10px] text-slate-400">المتبقي اليوم</span>
            <span className="text-sm font-black font-mono text-slate-200">
              {pendingTasks.length}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${barColorClass} transition-all duration-700`}
          style={{ width: `${completionRate}%` }}
        />
      </div>

      {/* Personalized Profile Encouragement & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            <span className="text-cyan-300 font-bold">رسالة توأمك الرقمي: </span>
            {personalizedMessage}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {priorityTargetTask && onStartFocus && (
            <button
              type="button"
              onClick={() => onStartFocus(priorityTargetTask)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{overdueCount > 0 ? 'حسم المتأخرة الآن' : 'بدء التركيز'}</span>
            </button>
          )}

          {overdueCount > 0 && onNavigateTasks && (
            <button
              type="button"
              onClick={onNavigateTasks}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
            >
              مراجعة المتأخرات
            </button>
          )}

          {onOpenChat && (
            <button
              type="button"
              onClick={() =>
                onOpenChat(
                  overdueCount > 0
                    ? `لدي ${overdueCount} مهام متأخرة ومعدل إنجازي ${completionRate}%. كيف أرتب ذهني وأستعيد السيطرة على يومي؟`
                    : `معدل إنجازي الآن ${completionRate}% ولا توجد مهام متأخرة. ما أفضل خطوة تالية لي؟`
                )
              }
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>استشارة التوأم</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
