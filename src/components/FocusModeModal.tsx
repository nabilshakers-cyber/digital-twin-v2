import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  Sliders, 
  BrainCircuit,
  CloudRain,
  Radio,
  Wind,
  ShieldCheck,
  BellOff,
  ArrowRight,
  Home,
  BookOpen,
  Square
} from 'lucide-react';
import { Task, DigitalTwinProfile } from '../types';
import {
  soundEngine,
  QURAN_RECITERS,
  QURAN_SURAH_PRESETS,
  type QuranReciterPreset,
} from '../utils/audioSynth';
import { useModalScrollLock } from '../utils/modalCoordinator';
import confetti from 'canvas-confetti';

interface FocusModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnToDashboard?: () => void;
  initialTask?: Task;
  tasks: Task[];
  profile: DigitalTwinProfile;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onCompleteTask: (taskId: string) => void;
  autoDndEnabled: boolean;
  onToggleAutoDnd: () => void;
  isDndActive: boolean;
  onFocusRunningChange: (isRunning: boolean) => void;
}

export const FocusModeModal: React.FC<FocusModeModalProps> = ({
  isOpen,
  onClose,
  onReturnToDashboard,
  initialTask,
  tasks,
  profile,
  onToggleSubtask,
  onCompleteTask,
  autoDndEnabled,
  onToggleAutoDnd,
  isDndActive,
  onFocusRunningChange,
}) => {
  const [selectedTask, setSelectedTask] = useState<Task | undefined>(initialTask);
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<'focus' | 'short_break' | 'long_break'>('focus');
  const [ambientType, setAmbientType] = useState<'none' | 'whitenoise' | 'rain' | 'binaural' | 'quran'>('none');
  const [quranSurah, setQuranSurah] = useState<number>(55);
  const [quranReciter, setQuranReciter] = useState<QuranReciterPreset['id']>('ar.alafasy');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.3);

  // Update selected task when initialTask changes
  useEffect(() => {
    if (initialTask) {
      setSelectedTask(initialTask);
    } else if (!selectedTask && tasks.length > 0) {
      setSelectedTask(tasks.find((t) => t.status !== 'completed') || tasks[0]);
    }
  }, [initialTask, tasks]);

  // Timer logic
  useEffect(() => {
    let interval: any = null;

    if (isActive) {
      interval = setInterval(() => {
        if (seconds > 0) {
          setSeconds((s) => s - 1);
        } else if (minutes > 0) {
          setMinutes((m) => m - 1);
          setSeconds(59);
        } else {
          // Timer completed
          soundEngine.playChime(true);
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          setIsActive(false);
          if (mode === 'focus') {
            setMode('short_break');
            setMinutes(5);
            setSeconds(0);
          } else {
            setMode('focus');
            setMinutes(25);
            setSeconds(0);
          }
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isActive, minutes, seconds, mode]);

  // Ambient sound handler
  const handleToggleAmbient = (type: 'whitenoise' | 'rain' | 'binaural' | 'quran') => {
    setAudioError(null);
    if (ambientType === type) {
      soundEngine.stopAmbient();
      setAmbientType('none');
    } else if (type === 'quran') {
      soundEngine.startQuranAmbient(quranSurah, quranReciter, volume, (msg) => {
        setAudioError(msg);
      });
      setAmbientType('quran');
    } else {
      soundEngine.startAmbient(type, volume);
      setAmbientType(type);
    }
  };

  const handleQuranConfigChange = (
    nextSurah: number,
    nextReciter: QuranReciterPreset['id']
  ) => {
    setQuranSurah(nextSurah);
    setQuranReciter(nextReciter);
    setAudioError(null);
    if (ambientType === 'quran') {
      soundEngine.startQuranAmbient(nextSurah, nextReciter, volume, (msg) => {
        setAudioError(msg);
      });
    }
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    soundEngine.setVolume(newVol);
  };

  const switchMode = (newMode: 'focus' | 'short_break' | 'long_break') => {
    setIsActive(false);
    setMode(newMode);
    if (newMode === 'focus') {
      setMinutes(25);
      setSeconds(0);
    } else if (newMode === 'short_break') {
      setMinutes(5);
      setSeconds(0);
    } else {
      setMinutes(15);
      setSeconds(0);
    }
  };

  // Notify parent when focus session timer is actively running inside the Focus Room
  useEffect(() => {
    const running = isOpen && isActive && mode === 'focus';
    onFocusRunningChange(running);
  }, [isOpen, isActive, mode, onFocusRunningChange]);

  useEffect(() => {
    if (!isOpen) {
      soundEngine.stopAmbient();
      setAmbientType('none');
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      soundEngine.stopAmbient();
      onFocusRunningChange(false);
    };
  }, [onFocusRunningChange]);

  const handleClose = () => {
    soundEngine.stopAmbient();
    setAmbientType('none');
    setIsActive(false);
    onFocusRunningChange(false);
    onClose();
  };

  const handleReturnHome = () => {
    soundEngine.stopAmbient();
    setAmbientType('none');
    setIsActive(false);
    onFocusRunningChange(false);
    if (onReturnToDashboard) {
      onReturnToDashboard();
    } else {
      onClose();
    }
  };

  const handleEndSession = () => {
    soundEngine.stopAmbient();
    soundEngine.playChime(true);
    setAmbientType('none');
    setIsActive(false);
    setMinutes(mode === 'focus' ? 25 : mode === 'short_break' ? 5 : 15);
    setSeconds(0);
    onFocusRunningChange(false);
    if (onReturnToDashboard) {
      onReturnToDashboard();
    } else {
      onClose();
    }
  };

  const activeQuote = useMemo(() => {
    const twinFocusQuotes = [
      `يا ${profile.name || 'صديقي'}، التركيز لمدة 25 دقيقة دون تفقد الإشعارات يعادل 3 ساعات من العمل المشتت.`,
      'العقل لا ينجز مهمتين عميقتين في نفس الوقت. مهمة واحدة الآن بكل ما أوتيت من عزيمة.',
      'التسويف ينكسر عند أول دقيقتين من البدء الفعلي. ابدأ بالخطوة الأولى البسيطة.',
      'أنا هنا أراقب إنجازك، اجعل تركيزك اليوم مضرب المثل.',
    ];
    return twinFocusQuotes[Math.floor(Math.random() * twinFocusQuotes.length)];
  }, [isOpen, profile.name]);

  useModalScrollLock('focus-modal', isOpen);

  if (!isOpen) return null;

  return (
    <div
      className="app-modal-overlay bg-slate-950/95 backdrop-blur-xl sm:p-4 animate-fadeIn"
      onClick={handleClose}
    >
      <div
        className="app-modal-panel max-w-2xl bg-gradient-to-b from-slate-900 via-[#0a0f1d] to-slate-950 border border-slate-800 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Sticky Top Action Bar: Return to Dashboard & Close (X) */}
        <div className="app-modal-header px-4 sm:px-6 py-3.5 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
          <button
            type="button"
            id="btn-focus-return-dashboard"
            onClick={handleReturnHome}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-cyan-600/20 text-cyan-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500/50 text-xs font-bold transition-all cursor-pointer"
            title="الرجوع إلى الواجهة الأساسية"
          >
            <ArrowRight className="w-4 h-4" />
            <Home className="w-3.5 h-3.5" />
            <span>الرجوع للواجهة الأساسية</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            aria-label="إغلاق غرفة التركيز"
            className="app-modal-close p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
            title="إغلاق غرفة التركيز"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="app-modal-body p-4 sm:p-6">

        {/* Header with Twin presence */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-800/60 text-amber-300 text-xs font-semibold">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            غرفة التركيز العميق (Deep Work Hub)
          </div>
          <h3 className="text-xl font-bold text-slate-100">
            جلسة إنجاز مستمرة مع نسختك الرقمية
          </h3>

          {/* Auto Focus / Do Not Disturb Status Pill */}
          <div className="pt-1 flex justify-center">
            <button
              type="button"
              id="btn-toggle-auto-dnd"
              onClick={onToggleAutoDnd}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-[11px] font-semibold transition-all cursor-pointer ${
                isDndActive
                  ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300 shadow-md shadow-emerald-500/10'
                  : autoDndEnabled
                  ? 'bg-indigo-950/50 border-indigo-800/60 text-indigo-300 hover:bg-indigo-950/80'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="انقر لتفعيل أو تعطيل وضع عدم الإزعاج التلقائي"
            >
              {isDndActive ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                  <span>وضع عدم الإزعاج مفعل تلقائياً — جميع التنبيهات وإشعارات المتصفح مخفية</span>
                </>
              ) : autoDndEnabled ? (
                <>
                  <BellOff className="w-3.5 h-3.5 text-indigo-400" />
                  <span>وضع التركيز التلقائي جاهز: سيتم كتم التنبيهات عند بدء الجلسة</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>وضع عدم الإزعاج التلقائي معطل (انقر للتفعيل)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mode Selector (Focus vs Breaks) */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => switchMode('focus')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'focus'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            جلسة تركيز (25 د)
          </button>
          <button
            onClick={() => switchMode('short_break')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'short_break'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            استراحة قصيرة (5 د)
          </button>
          <button
            onClick={() => switchMode('long_break')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              mode === 'long_break'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            استراحة طويلة (15 د)
          </button>
        </div>

        {/* Giant Timer Display */}
        <div className="my-8 text-center">
          <div className="text-7xl sm:text-8xl font-black font-mono tracking-tight text-slate-100 select-none">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-black shadow-xl transition-all cursor-pointer ${
                isActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/30'
              }`}
            >
              {isActive ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              <span>{isActive ? 'إيقاف مؤقت' : 'بدء التركيز الآن'}</span>
            </button>

            <button
              type="button"
              id="btn-focus-end-session"
              onClick={handleEndSession}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-emerald-600/20 text-emerald-300 hover:text-emerald-200 border border-slate-700 hover:border-emerald-500/50 text-sm font-bold shadow-lg transition-all cursor-pointer"
              title="إنهاء جلسة التركيز والعودة إلى القائمة الرئيسية"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>إنهاء الجلسة</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsActive(false);
                setMinutes(mode === 'focus' ? 25 : mode === 'short_break' ? 5 : 15);
                setSeconds(0);
              }}
              className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
              title="إعادة ضبط العداد"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active Task Selector & Subtask Checklist */}
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">المهمة النشطة المستهدفة:</span>
            
            <select
              value={selectedTask?.id || ''}
              onChange={(e) => {
                const found = tasks.find((t) => t.id === e.target.value);
                setSelectedTask(found);
              }}
              aria-label="اختر المهمة المستهدفة"
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              {tasks
                .filter((t) => t.status !== 'completed')
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </div>

          {selectedTask ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-xs font-semibold text-slate-100">{selectedTask.title}</span>
                <button
                  onClick={() => {
                    onCompleteTask(selectedTask.id);
                    soundEngine.playChime(true);
                    confetti({ particleCount: 50, spread: 60 });
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 text-[11px] font-medium"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>إكمال المهمة الآن</span>
                </button>
              </div>

              {/* Subtasks checklist if present */}
              {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-semibold text-slate-400">خطوات المهمة:</span>
                  {selectedTask.subtasks.map((sub) => (
                    <label
                      key={sub.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs text-slate-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={sub.completed}
                        onChange={() => onToggleSubtask(selectedTask.id, sub.id)}
                        className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-cyan-500"
                      />
                      <span className={sub.completed ? 'line-through text-slate-500' : ''}>{sub.title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">لم يتم تحديد مهمة، ركز على هدفك الحر.</p>
          )}
        </div>

        {/* Ambient Sound Generator Controls */}
        <div className="mt-5 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-slate-400 font-semibold">أصوات عزل الضجيج:</span>

              <button
                type="button"
                id="btn-ambient-quran"
                onClick={() => handleToggleAmbient('quran')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  ambientType === 'quran'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:text-emerald-300 hover:border-emerald-700/60'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>القرآن الكريم (صوت ندي)</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleAmbient('rain')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  ambientType === 'rain'
                    ? 'bg-blue-950 text-blue-300 border-blue-700 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5" />
                <span>مطر هادئ</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleAmbient('whitenoise')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  ambientType === 'whitenoise'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Wind className="w-3.5 h-3.5" />
                <span>ضجيج أبيض</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleAmbient('binaural')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  ambientType === 'binaural'
                    ? 'bg-purple-950 text-purple-300 border-purple-700 font-bold'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>أمواج ألفا</span>
              </button>
            </div>

            {ambientType !== 'none' && (
              <div className="flex items-center gap-2 w-full sm:w-36 shrink-0">
                <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  aria-label="مستوى الصوت"
                  className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>

          {ambientType === 'quran' && (
            <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-emerald-300 font-semibold ml-1">السورة:</span>
                {QURAN_SURAH_PRESETS.map((surah) => (
                  <button
                    key={surah.id}
                    type="button"
                    onClick={() => handleQuranConfigChange(surah.id, quranReciter)}
                    className={`px-2 py-1 rounded-lg text-[11px] border transition-colors cursor-pointer ${
                      quranSurah === surah.id
                        ? 'bg-emerald-600/25 border-emerald-500/70 text-emerald-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {surah.name}
                  </button>
                ))}
              </div>

              <select
                value={quranReciter}
                onChange={(e) =>
                  handleQuranConfigChange(
                    quranSurah,
                    e.target.value as QuranReciterPreset['id']
                  )
                }
                aria-label="اختيار القارئ"
                className="bg-slate-950 border border-emerald-800/60 rounded-lg px-2.5 py-1 text-[11px] text-emerald-200 focus:outline-none focus:border-emerald-500"
              >
                {QURAN_RECITERS.map((rec) => (
                  <option key={rec.id} value={rec.id}>
                    {rec.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {audioError && (
            <p className="text-[11px] text-rose-300 bg-rose-950/50 border border-rose-800/60 px-2.5 py-1.5 rounded-lg">
              {audioError}
            </p>
          )}
        </div>

        {/* Digital Twin Encouragement */}
        <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-xs text-indigo-300">
          <BrainCircuit className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">{activeQuote}</p>
        </div>

        </div>
      </div>
    </div>
  );
};
