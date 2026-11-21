import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Briefcase,
  Check,
  HeartPulse,
  Moon,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import type { OnboardingFocusArea } from '../types';
import type { OnboardingChoices } from '../utils/onboardingPersonalization';

interface OnboardingScreenProps {
  initialName?: string;
  onComplete: (choices: OnboardingChoices) => void;
}

const TOTAL_STEPS = 4;

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  initialName = '',
  onComplete,
}) => {
  const [step, setStep] = useState<number>(1);
  const [name, setName] = useState<string>(initialName);
  const [preferredTimePeriod, setPreferredTimePeriod] = useState<'morning' | 'evening'>('morning');
  const [focusAreas, setFocusAreas] = useState<OnboardingFocusArea[]>(['work', 'worship']);
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleFocusArea = (area: OnboardingFocusArea) => {
    setValidationError(null);
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area]
    );
  };

  const handleNext = () => {
    setValidationError(null);
    if (step === 2 && name.trim().length < 2) {
      setValidationError('يرجى كتابة اسمك (حرفان على الأقل) لنخصص الواجهة باسمك.');
      return;
    }
    if (step === 4) {
      if (focusAreas.length === 0) {
        setValidationError('يرجى اختيار مجال واحد على الأقل لتخصيص الواجهة الرئيسية.');
        return;
      }
      onComplete({
        name: name.trim(),
        preferredTimePeriod,
        focusAreas,
      });
      return;
    }
    setStep((prev) => Math.min(TOTAL_STEPS, prev + 1));
  };

  const handleBack = () => {
    setValidationError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const progressWidthClass =
    step === 1 ? 'w-1/4' : step === 2 ? 'w-1/2' : step === 3 ? 'w-3/4' : 'w-full';

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden"
    >
      <div className="pointer-events-none absolute -top-40 right-1/4 w-96 h-96 rounded-full bg-emerald-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/4 w-96 h-96 rounded-full bg-cyan-600/15 blur-3xl" />

      <div className="w-full max-w-xl relative z-10 space-y-5 animate-fadeIn">
        {/* Progress Header */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-cyan-300">الإعداد الشخصي الأولي</span>
            <span className="font-mono">
              الخطوة {step} من {TOTAL_STEPS}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-500 transition-all duration-300 ${progressWidthClass}`}
            />
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {validationError && (
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* STEP 1: الترحيب */}
          {step === 1 && (
            <div className="text-center space-y-5 py-2 animate-fadeIn">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-emerald-500/20 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                <Bot className="w-10 h-10 text-cyan-300" />
              </div>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>أهلاً بك في التوأم الرقمي</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  مرحباً بك! لنُصمّم مساحتك على مقاسك
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed max-w-md mx-auto">
                  في 3 خطوات سريعة، سنتعرّف على اسمك وأوقات ذروتك ومجالات تركيزك لنُرتّب لك اللوحة الرئيسية ونضبط تذكيراتك تلقائياً.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs pt-2">
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <User className="w-4 h-4 text-cyan-400 mx-auto" />
                  <p className="font-bold text-slate-200">هوية مخصصة</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <Sun className="w-4 h-4 text-amber-400 mx-auto" />
                  <p className="font-bold text-slate-200">توقيت ذروتك</p>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <BookOpen className="w-4 h-4 text-emerald-400 mx-auto" />
                  <p className="font-bold text-slate-200">ترتيب الأولويات</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: إدخال الاسم */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-cyan-400">الخطوة 2</span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  بأي اسم تحب أن نخاطبك؟
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  سيظهر اسمك في بطاقة التوأم الرقمي والإحاطات اليومية التحفيزية.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="onboarding-name-input" className="text-xs font-semibold text-slate-300 block">
                  الاسم الشخصي
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="onboarding-name-input"
                    type="text"
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                    placeholder="مثال: أحمد، سارة، أبو عبدالله..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pr-11 pl-4 py-3.5 text-base text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: تفضيل الوقت (صباحي / مسائي) */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-cyan-400">الخطوة 3</span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  متى تكون في قمة نشاطك وتركيزك؟
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  سنستخدم اختيارك لضبط فترة الذروة في التوأم الرقمي وتوزيع مهامك الشاقة.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  type="button"
                  id="btn-onboarding-time-morning"
                  onClick={() => setPreferredTimePeriod('morning')}
                  className={`p-5 rounded-2xl border text-right transition-all cursor-pointer space-y-3 ${
                    preferredTimePeriod === 'morning'
                      ? 'bg-amber-500/15 border-amber-400 shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
                      <Sun className="w-6 h-6" />
                    </div>
                    {preferredTimePeriod === 'morning' && (
                      <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">صباحي</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      أنجز أفضل أعمالي في الساعات الأولى بعد الفجر والصباح الباكر.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-onboarding-time-evening"
                  onClick={() => setPreferredTimePeriod('evening')}
                  className={`p-5 rounded-2xl border text-right transition-all cursor-pointer space-y-3 ${
                    preferredTimePeriod === 'evening'
                      ? 'bg-indigo-500/20 border-indigo-400 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                      <Moon className="w-6 h-6" />
                    </div>
                    {preferredTimePeriod === 'evening' && (
                      <span className="w-6 h-6 rounded-full bg-indigo-400 text-slate-950 flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">مسائي</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      يصفو ذهني ويزداد تركيزي في ساعات المساء والهدوء الليلي.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: اختيار المجالات (عمل / عبادة / صحة) */}
          {step === 4 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-cyan-400">الخطوة 4</span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  ما هي مجالات تركيزك الأساسية؟
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  يمكنك اختيار أكثر من مجال. سنُبرز الأدوات المناسبة في أعلى الواجهة الرئيسية تلقائياً.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    id: 'work' as OnboardingFocusArea,
                    title: 'عمل',
                    desc: 'إدارة المشاريع، الأولويات العاجلة، ومتابعة الإنجاز الأسبوعي.',
                    icon: Briefcase,
                    activeClasses: 'bg-cyan-500/15 border-cyan-400 shadow-lg shadow-cyan-500/10',
                    iconClasses: 'bg-cyan-500/20 border-cyan-400/30 text-cyan-300',
                    checkClasses: 'bg-cyan-400 text-slate-950',
                  },
                  {
                    id: 'worship' as OnboardingFocusArea,
                    title: 'عبادة',
                    desc: 'إبراز ويدجت القرآن الكريم وأذكار الصباح والمساء في واجهتك الرئيسية.',
                    icon: BookOpen,
                    activeClasses:
                      'bg-emerald-500/15 border-emerald-400 shadow-lg shadow-emerald-500/10',
                    iconClasses: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
                    checkClasses: 'bg-emerald-400 text-slate-950',
                  },
                  {
                    id: 'health' as OnboardingFocusArea,
                    title: 'صحة',
                    desc: 'مراقبة التوازن الذهني ومستوى الطاقة ومنع الإرهاق اليومي.',
                    icon: HeartPulse,
                    activeClasses: 'bg-rose-500/15 border-rose-400 shadow-lg shadow-rose-500/10',
                    iconClasses: 'bg-rose-500/20 border-rose-400/30 text-rose-300',
                    checkClasses: 'bg-rose-400 text-slate-950',
                  },
                ].map((area) => {
                  const Icon = area.icon;
                  const selected = focusAreas.includes(area.id);
                  return (
                    <button
                      key={area.id}
                      type="button"
                      id={`btn-onboarding-area-${area.id}`}
                      onClick={() => toggleFocusArea(area.id)}
                      className={`w-full p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-4 ${
                        selected
                          ? area.activeClasses
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${area.iconClasses}`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-white">{area.title}</h3>
                          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                            {area.desc}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                          selected
                            ? `${area.checkClasses} border-transparent`
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {selected && <Check className="w-4 h-4 stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            {step > 1 ? (
              <button
                type="button"
                id="btn-onboarding-back"
                onClick={handleBack}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>السابق</span>
              </button>
            ) : (
              <span />
            )}

            <button
              type="button"
              id="btn-onboarding-next"
              onClick={handleNext}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 via-indigo-600 to-emerald-600 hover:from-cyan-500 hover:via-indigo-500 hover:to-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-cyan-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>
                {step === 1
                  ? 'ابدأ الإعداد الآن'
                  : step === TOTAL_STEPS
                  ? 'حفظ والبدء في التوأم الرقمي'
                  : 'التالي'}
              </span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
