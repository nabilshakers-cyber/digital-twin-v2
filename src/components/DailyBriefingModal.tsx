import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Loader2, 
  Sun, 
  Moon, 
  BrainCircuit, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  Flame, 
  Quote
} from 'lucide-react';
import { DailyBriefing, DigitalTwinProfile, Task, TimeBlock } from '../types';
import { generateBriefingWithAI } from '../utils/api';

interface DailyBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'morning' | 'evening';
  profile: DigitalTwinProfile;
  tasks: Task[];
  schedule: TimeBlock[];
}

export const DailyBriefingModal: React.FC<DailyBriefingModalProps> = ({
  isOpen,
  onClose,
  type,
  profile,
  tasks,
  schedule,
}) => {
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBriefing();
    } else {
      if (isSpeaking) {
        window.speechSynthesis?.cancel();
        setIsSpeaking(false);
      }
    }
  }, [isOpen, type]);

  const fetchBriefing = async () => {
    setIsLoading(true);
    try {
      const completed = tasks.filter((t) => t.status === 'completed');
      const data = await generateBriefingWithAI({
        type,
        profile,
        tasks,
        completedTasks: completed,
        schedule,
      });
      setBriefing(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = () => {
    if (!briefing || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = `${briefing.headline}. ${briefing.mainAdvice}. أولويات اليوم: ${briefing.topPriorities.join(', ')}. ${briefing.energyQuote}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden bg-gradient-to-b from-slate-900 via-[#0c1222] to-slate-950 border border-slate-800 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Always-Visible Close (X) */}
        <div className="shrink-0 sticky top-0 z-20 p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ${
              type === 'morning' 
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 shadow-amber-500/20' 
                : 'bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-indigo-500/20'
            }`}>
              {type === 'morning' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 truncate">
                {type === 'morning' ? 'الموجز الصباحي وتوجيه اليوم' : 'جلسة المراجعة المسائية'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                توليد ذكي من نسختك الرقمية لتوجيه ذهنك وطاقتك
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
          {/* Loading */}
          {isLoading && (
            <div className="py-14 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400 mx-auto" />
              <p className="text-xs text-slate-300 font-semibold">
                نسختك الرقمية تجمع بيانات اليوم وتصيغ لك التوجيه...
              </p>
            </div>
          )}

          {/* Content */}
          {!isLoading && briefing && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* Headline */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-950 to-cyan-950/40 border border-cyan-900/50">
                <h4 className="text-base font-bold text-cyan-300 leading-snug">
                  {briefing.headline}
                </h4>
              </div>

              {/* Main Advice */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  التوجيه الاستراتيجي لليوم:
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">
                  {briefing.mainAdvice}
                </p>
              </div>

              {/* Top Priorities / Accomplishments */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300">
                  {type === 'morning' ? 'الأهداف الثلاثة الحاسمة:' : 'أبرز الإنجازات والدروس:'}
                </span>
                <div className="space-y-1.5">
                  {briefing.topPriorities?.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Energy Quote */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-900/40 flex items-start gap-2.5 text-xs text-indigo-300">
                <Quote className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="italic font-medium">{briefing.energyQuote}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  onClick={handleSpeak}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-medium cursor-pointer"
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span>{isSpeaking ? 'إيقاف الصوت' : 'استماع للموجز'}</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 cursor-pointer"
                >
                  انطلاق وبدء التنفيذ
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
