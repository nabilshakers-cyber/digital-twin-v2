import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  Check,
  Calendar,
  CheckSquare,
  Globe,
  X,
  Wand2,
  Volume2,
  Zap,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Task, TimeBlock } from '../types';
import { useWebSpeech } from '../hooks/useWebSpeech';
import { FRIENDLY_AI_CONNECTION_ERROR, parseQuickEntryWithAI } from '../utils/api';
import { soundEngine } from '../utils/audioSynth';

interface VoiceCommandPanelProps {
  onAddExtracted: (tasks: Partial<Task>[], events: Partial<TimeBlock>[]) => void;
}

const SAMPLE_VOICE_COMMANDS = [
  'أضف مهمة مراجعة التقرير المالي غداً الساعة 10 صباحاً',
  'حدد موعد اجتماع مع فريق التصميم اليوم من 3 إلى 4 عصراً',
  'أضف مهمة عاجلة إرسال العرض للعميل خلال 30 دقيقة',
];

export const VoiceCommandPanel: React.FC<VoiceCommandPanelProps> = ({ onAddExtracted }) => {
  const [commandText, setCommandText] = useState('');
  const [autoAddOnVoice, setAutoAddOnVoice] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [canRetryParse, setCanRetryParse] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [extractedResult, setExtractedResult] = useState<{
    extractedTasks: Partial<Task>[];
    extractedEvents: Partial<TimeBlock>[];
    twinComment: string;
  } | null>(null);

  const runVoiceExtraction = async (textToParse: string, autoConfirm: boolean) => {
    const clean = textToParse.trim();
    if (!clean) {
      setCanRetryParse(false);
      setParseError('يرجى كتابة عنوان المهمة أولاً.');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setCanRetryParse(false);
    setSuccessMessage(null);

    try {
      const result = await parseQuickEntryWithAI({
        naturalText: clean,
        currentDate: new Date().toISOString(),
      });

      const hasTasks = (result.extractedTasks?.length || 0) > 0;
      const hasEvents = (result.extractedEvents?.length || 0) > 0;

      if (!hasTasks && !hasEvents) {
        setExtractedResult(result);
        setParseError('لم يتم التعرف على مهمة أو موعد محدد في الجملة؛ يمكنك تعديل النص والمحاولة مجدداً.');
        return;
      }

      if (autoConfirm) {
        onAddExtracted(result.extractedTasks || [], result.extractedEvents || []);
        soundEngine.playChime(true);
        confetti({ particleCount: 55, spread: 65 });
        const countTasks = result.extractedTasks?.length || 0;
        const countEvents = result.extractedEvents?.length || 0;
        setSuccessMessage(
          `تمت إضافة ${countTasks > 0 ? `${countTasks} مهمة` : ''}${
            countTasks > 0 && countEvents > 0 ? ' و ' : ''
          }${countEvents > 0 ? `${countEvents} موعد` : ''} عبر الأمر الصوتي بنجاح!`
        );
        setExtractedResult(null);
        setCommandText('');
      } else {
        setExtractedResult(result);
      }
    } catch (err: any) {
      console.error('[VoiceCommandPanel] parseQuickEntryWithAI failed:', err);
      setCanRetryParse(true);
      setParseError(FRIENDLY_AI_CONNECTION_ERROR);
    } finally {
      setIsParsing(false);
    }
  };

  const {
    isSupported,
    lang,
    setLang,
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    setError: setSpeechError,
    startListening,
    stopListening,
    resetSpeech,
  } = useWebSpeech({
    lang: 'ar-SA',
    continuous: false,
    onFinalTranscript: (finalText) => {
      setCommandText(finalText);
      void runVoiceExtraction(finalText, autoAddOnVoice);
    },
  });

  useEffect(() => {
    if (transcript) {
      setCommandText(transcript);
    }
  }, [transcript]);

  const handleToggleMic = () => {
    setParseError(null);
    setSuccessMessage(null);
    if (isListening) {
      stopListening();
    } else {
      resetSpeech();
      setExtractedResult(null);
      startListening();
    }
  };

  const handleConfirmExtracted = () => {
    if (!extractedResult) return;
    onAddExtracted(
      extractedResult.extractedTasks || [],
      extractedResult.extractedEvents || []
    );
    soundEngine.playChime(true);
    confetti({ particleCount: 55, spread: 65 });
    const countTasks = extractedResult.extractedTasks?.length || 0;
    const countEvents = extractedResult.extractedEvents?.length || 0;
    setSuccessMessage(
      `تم إدراج ${countTasks > 0 ? `${countTasks} مهمة` : ''}${
        countTasks > 0 && countEvents > 0 ? ' و ' : ''
      }${countEvents > 0 ? `${countEvents} موعد` : ''} في نظامك بنجاح.`
    );
    setExtractedResult(null);
    setCommandText('');
    resetSpeech();
  };

  const displayValue = isListening
    ? [commandText, interimTranscript].filter(Boolean).join(' ')
    : commandText;

  return (
    <section
      id="dashboard-voice-command-panel"
      className="bg-gradient-to-br from-slate-900 via-[#0d1528] to-slate-900/95 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 shadow-lg shadow-cyan-950/20 space-y-3.5"
    >
      {/* Top Row: Title + Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-dashboard-voice-command"
            onClick={handleToggleMic}
            disabled={!isSupported || isParsing}
            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isListening
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/40 scale-105'
                : 'bg-gradient-to-tr from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-md shadow-cyan-600/25 disabled:opacity-40'
            }`}
            title={
              !isSupported
                ? 'المتصفح لا يدعم Web Speech API'
                : isListening
                ? 'إيقاف الاستماع'
                : 'اضغط وتحدث لإضافة مهمة أو موعد'
            }
          >
            {isListening && (
              <span className="absolute inset-0 rounded-2xl bg-rose-400 animate-ping opacity-35" />
            )}
            {isListening ? <MicOff className="w-5 h-5 relative z-10" /> : <Mic className="w-5 h-5" />}
          </button>

          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <span>الأوامر الصوتية المباشرة (Web Speech API)</span>
              {isListening && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/60 animate-pulse">
                  جاري الاستماع...
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              اضغط على الميكروفون وانطق مهمتك أو موعدك ليتم تحويله وإضافته فورياً
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language Switch */}
          <button
            type="button"
            onClick={() => setLang(lang === 'ar-SA' ? 'en-US' : 'ar-SA')}
            disabled={isListening}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
            title="تبديل لغة التعرف على الكلام"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{lang === 'ar-SA' ? 'العربية (SA)' : 'English (US)'}</span>
          </button>

          {/* Auto-insert Toggle */}
          <button
            type="button"
            id="btn-voice-auto-add-toggle"
            onClick={() => setAutoAddOnVoice((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
              autoAddOnVoice
                ? 'bg-emerald-950/70 border-emerald-600/60 text-emerald-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
            title="عند التفعيل يتم إدراج المهام والمواعيد تلقائياً بمجرد انتهاء الكلام"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{autoAddOnVoice ? 'إدراج تلقائي: مفعل' : 'معاينة قبل الإدراج'}</span>
          </button>
        </div>
      </div>

      {/* Unsupported Browser Notice */}
      {!isSupported && (
        <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/50 text-xs text-amber-200 flex items-center gap-2">
          <Volume2 className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            متصفحك الحالي لا يدعم التعرف المباشر على الكلام (Web Speech API). يفضّل استخدام Chrome أو Edge، أو كتابة الأمر أدناه للتحليل الفوري.
          </span>
        </div>
      )}

      {/* Transcript Input + Analyze Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runVoiceExtraction(commandText, false);
        }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            id="input-voice-command-transcript"
            value={displayValue}
            onChange={(e) => {
              setCommandText(e.target.value);
              if (parseError && e.target.value.trim()) {
                setParseError(null);
                setCanRetryParse(false);
              }
            }}
            readOnly={isListening}
            placeholder={
              isListening
                ? 'تحدث الآن... يظهر كلامك هنا مباشرة'
                : 'انطق أمرك بالضغط على الميكروفون أو اكتبه هنا (مثال: اجتماع الساعة 5 مساءً)...'
            }
            className={`w-full bg-slate-950/90 border rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors ${
              isListening
                ? 'border-rose-500/70 ring-1 ring-rose-500/30'
                : 'border-slate-800 focus:border-cyan-500'
            }`}
          />
          {commandText && !isListening && (
            <button
              type="button"
              onClick={() => {
                setCommandText('');
                setExtractedResult(null);
                setParseError(null);
                setCanRetryParse(false);
                resetSpeech();
              }}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 cursor-pointer"
              title="مسح النص"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {isParsing ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-950/70 border border-cyan-700/60 text-cyan-300 text-xs font-bold shrink-0"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="animate-pulse">جاري التفكير...</span>
          </div>
        ) : (
          <button
            type="submit"
            id="btn-parse-voice-command"
            disabled={isListening}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer shrink-0"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>استخراج وإضافة</span>
          </button>
        )}
      </form>

      {/* Quick Sample Chips */}
      {!extractedResult && !isListening && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-slate-500 ml-1">أمثلة سريعة:</span>
          {SAMPLE_VOICE_COMMANDS.map((sample, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCommandText(sample);
                void runVoiceExtraction(sample, false);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800/75 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700/70 transition-colors cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </div>
      )}

      {/* Speech or Parse Error */}
      {(speechError || parseError) && (
        <div className="px-3 py-2.5 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-200 flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{speechError || parseError}</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {canRetryParse && !speechError && (
              <button
                type="button"
                disabled={isParsing}
                onClick={() => void runVoiceExtraction(commandText, autoAddOnVoice)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>إعادة المحاولة</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSpeechError(null);
                setParseError(null);
                setCanRetryParse(false);
              }}
              className="text-rose-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Success Toast Inside Card */}
      {successMessage && (
        <div className="px-3 py-2.5 rounded-xl bg-emerald-950/70 border border-emerald-700/60 text-xs text-emerald-200 flex items-center justify-between gap-2 animate-fadeIn">
          <span className="flex items-center gap-1.5 font-semibold">
            <Check className="w-4 h-4 text-emerald-400" />
            {successMessage}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Extracted Preview Card */}
      {extractedResult && (
        <div className="bg-slate-950/90 rounded-2xl border border-cyan-800/50 p-3.5 space-y-3 animate-fadeIn">
          {extractedResult.twinComment && (
            <div className="text-xs text-cyan-300 bg-cyan-950/40 p-2.5 rounded-xl border border-cyan-800/40 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{extractedResult.twinComment}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {extractedResult.extractedTasks?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  مهام جاهزة للإضافة ({extractedResult.extractedTasks.length})
                </span>
                <div className="space-y-1">
                  {extractedResult.extractedTasks.map((t, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <span className="text-slate-100 font-medium truncate">{t.title}</span>
                      <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded shrink-0">
                        {t.dueTime ? `${t.dueTime} • ` : ''}
                        {t.estimatedMinutes || 30} د
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extractedResult.extractedEvents?.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  مواعيد جاهزة للجدول ({extractedResult.extractedEvents.length})
                </span>
                <div className="space-y-1">
                  {extractedResult.extractedEvents.map((ev, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <span className="text-slate-100 font-medium truncate">{ev.title}</span>
                      <span className="text-[10px] font-mono text-cyan-300 bg-slate-800 px-2 py-0.5 rounded shrink-0">
                        {ev.startTime} - {ev.endTime}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setExtractedResult(null)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              id="btn-confirm-voice-extracted"
              onClick={handleConfirmExtracted}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>تأكيد الإدراج في المهام والجدول</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
