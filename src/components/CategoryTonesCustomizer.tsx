import React, { useState } from 'react';
import { Volume2, RotateCcw, Music2, Check, VolumeX } from 'lucide-react';
import { AlertToneId, soundEngine } from '../utils/audioSynth';
import {
  ALERT_CATEGORY_CONFIGS,
  ALERT_TONE_PRESETS,
  AlertCategoryKey,
  useCategoryTones,
} from '../utils/notificationTones';

interface CategoryTonesCustomizerProps {
  soundEnabled?: boolean;
  onEnableSound?: () => void;
}

export const CategoryTonesCustomizer: React.FC<CategoryTonesCustomizerProps> = ({
  soundEnabled = true,
  onEnableSound,
}) => {
  const { tones, updateTone, resetTones } = useCategoryTones();
  const [previewingKey, setPreviewingKey] = useState<AlertCategoryKey | null>(null);
  const [resetToast, setResetToast] = useState(false);

  const handlePreviewTone = (category: AlertCategoryKey, toneId: AlertToneId) => {
    setPreviewingKey(category);
    soundEngine.playTone(toneId);
    setTimeout(() => {
      setPreviewingKey((prev) => (prev === category ? null : prev));
    }, 1000);
  };

  const handleSelectTone = (category: AlertCategoryKey, toneId: AlertToneId) => {
    updateTone(category, toneId);
    if (toneId !== 'silent') {
      handlePreviewTone(category, toneId);
    }
  };

  const handleReset = () => {
    resetTones();
    setResetToast(true);
    setTimeout(() => setResetToast(false), 2500);
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-indigo-800/40 space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-300 shrink-0">
            <Music2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-slate-100">
              تخصيص نغمات التنبيه حسب الفئة
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              اختر نغمة مميزة لكل فئة (مثل نغمة واضحة للعمل مقابل نغمة روحانية هادئة للأذكار) لتمييز التنبيه فوراً دون النظر للشاشة.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          {resetToast ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300">تمت الاستعادة</span>
            </>
          ) : (
            <>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>نغمات افتراضية</span>
            </>
          )}
        </button>
      </div>

      {!soundEnabled && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/50 flex flex-wrap items-center justify-between gap-2 text-[11px] text-amber-200">
          <span className="flex items-center gap-1.5">
            <VolumeX className="w-4 h-4 text-amber-400 shrink-0" />
            أصوات التنبيه مكتومة حالياً في التطبيق — يمكنك معاينة النغمات هنا أو تفعيل الصوت للتنبيهات التلقائية.
          </span>
          {onEnableSound && (
            <button
              type="button"
              onClick={onEnableSound}
              className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
            >
              تفعيل الصوت
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ALERT_CATEGORY_CONFIGS.map((cat) => {
          const selectedTone = tones[cat.key];
          const isPreviewing = previewingKey === cat.key;
          const isSilent = selectedTone === 'silent';

          return (
            <div
              key={cat.key}
              className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-lg border text-[11px] font-bold ${cat.badgeClass}`}
                  >
                    {cat.label}
                  </span>
                  {isPreviewing && (
                    <span className="text-[10px] font-bold text-cyan-300 animate-pulse">
                      جارٍ التشغيل...
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{cat.examples}</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <select
                  aria-label={`نغمة تنبيه ${cat.label}`}
                  value={selectedTone}
                  onChange={(e) => handleSelectTone(cat.key, e.target.value as AlertToneId)}
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {ALERT_TONE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={isSilent}
                  onClick={() => handlePreviewTone(cat.key, selectedTone)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isPreviewing
                      ? 'bg-cyan-600 text-white border-cyan-500'
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
                  }`}
                  title={isSilent ? 'الفئة مضبوطة على صامت' : `معاينة نغمة ${cat.label}`}
                >
                  {isSilent ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span>معاينة</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
