import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Bot,
  Sparkles,
  BrainCircuit,
  Loader2,
  User,
  Volume2,
  Flame,
  Calendar,
  CheckCircle2,
  Mic,
  Square,
  Trash2,
  FileAudio,
  CheckSquare,
  Plus,
  Target,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import {
  ChatMessage,
  DailyAdhkarState,
  DigitalTwinProfile,
  LongTermGoal,
  QuranRoutineItem,
  Task,
  TimeBlock,
} from '../types';
import { askDigitalAssistant, processVoiceNoteWithAI } from '../utils/api';
import { useModalScrollLock } from '../utils/modalCoordinator';

interface TwinChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: DigitalTwinProfile;
  tasks: Task[];
  schedule: TimeBlock[];
  goals?: LongTermGoal[];
  quranRoutine?: QuranRoutineItem[];
  adhkarState?: DailyAdhkarState;
  initialPrompt?: string;
  onStartFocus: (task?: Task) => void;
  onNavigateTab: (tab: 'tasks' | 'schedule' | 'focus') => void;
  onAddExtractedTasks: (tasks: Partial<Task>[], events: Partial<TimeBlock>[]) => void;
  onAddGoal?: (goal: Omit<LongTermGoal, 'id'>) => void;
  onOptimizeSchedule?: () => void;
}

export const TwinChatDrawer: React.FC<TwinChatDrawerProps> = ({
  isOpen,
  onClose,
  profile,
  tasks,
  schedule,
  goals = [],
  quranRoutine = [],
  adhkarState,
  initialPrompt,
  onStartFocus,
  onNavigateTab,
  onAddExtractedTasks,
  onAddGoal,
  onOptimizeSchedule,
}) => {
  const buildInitialMessage = (): ChatMessage => ({
    id: 'm-init',
    role: 'twin',
    content: `مرحباً بك يا ${profile.name || 'صديقي'}. أنا المساعد الرقمي AI وعقلك الثاني المتصل بمهامك وجدولك الهجري والميلادي وأهدافك ووردك اليومي. اطلب مني التخطيط، إضافة مهام، ترتيب أولوياتك، أو سجّل ملاحظة صوتية وسأنفذها لك فوراً.`,
    timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => [buildInitialMessage()]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingElapsedSec, setLoadingElapsedSec] = useState(0);
  const [isWakingServer, setIsWakingServer] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRecordingRef = useRef<boolean>(false);
  const recordingDurationRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeRequestAbortRef = useRef<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Send initial prompt if opened with one
  useEffect(() => {
    if (isOpen && initialPrompt) {
      handleSendMessage(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isProcessingVoice]);

  // Track elapsed waiting seconds (up to 60s) while connecting/waking up server
  useEffect(() => {
    if (!isLoading && !isProcessingVoice) {
      setLoadingElapsedSec(0);
      setIsWakingServer(false);
      return;
    }
    setLoadingElapsedSec(0);
    const interval = setInterval(() => {
      setLoadingElapsedSec((prev) => (prev < 60 ? prev + 1 : 60));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading, isProcessingVoice]);

  // Clean up mic stream & in-flight requests
  useEffect(() => {
    if (!isOpen && isRecording) {
      cancelRecording();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      activeRequestAbortRef.current?.abort();
    };
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);
    setIsWakingServer(false);

    activeRequestAbortRef.current?.abort();
    const controller = new AbortController();
    activeRequestAbortRef.current = controller;

    try {
      const result = await askDigitalAssistant(
        {
          message: userMsg.content,
          history: messages,
          profile,
          tasks,
          schedule,
          goals,
          quranRoutine,
          adhkarState,
          currentDate: new Date().toISOString(),
        },
        {
          timeoutMs: 60_000,
          retryOnColdStart: true,
          signal: controller.signal,
          onWaitingForWakeup: () => {
            setIsWakingServer(true);
          },
        }
      );

      const twinMsg: ChatMessage = {
        id: `t-${Date.now()}`,
        role: 'twin',
        content: result.reply,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        extractedTasks: result.suggestedTasks,
        extractedEvents: result.suggestedEvents,
        suggestedGoals: result.suggestedGoals,
        tasksImported: false,
        goalsImported: false,
        suggestedAction:
          result.suggestedAction && result.suggestedAction.type !== 'none'
            ? result.suggestedAction
            : undefined,
      };

      setMessages((prev) => [...prev, twinMsg]);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `t-err-${Date.now()}`,
          role: 'twin',
          content:
            err?.message ||
            'عذراً، حدث خطأ في الاتصال بالمساعد الرقمي AI. يرجى المحاولة مرة أخرى.',
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      if (activeRequestAbortRef.current === controller) {
        activeRequestAbortRef.current = null;
      }
      setIsLoading(false);
      setIsWakingServer(false);
    }
  };

  // Text to Speech
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.rate = 1.0;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Convert Blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('تعذر قراءة الملف الصوتي'));
      reader.readAsDataURL(blob);
    });
  };

  const cleanupRecordingResources = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  const handleAudioBlobSubmit = async (blob: Blob, durationSec: number) => {
    setIsProcessingVoice(true);
    setIsWakingServer(false);
    setVoiceError(null);

    activeRequestAbortRef.current?.abort();
    const controller = new AbortController();
    activeRequestAbortRef.current = controller;

    try {
      const audioBase64 = await blobToBase64(blob);
      const mimeType = blob.type || 'audio/webm';

      const result = await processVoiceNoteWithAI(
        {
          audioBase64,
          mimeType,
          profile,
          tasks,
          schedule,
          currentDate: new Date().toISOString(),
        },
        {
          timeoutMs: 60_000,
          retryOnColdStart: true,
          signal: controller.signal,
          onWaitingForWakeup: () => {
            setIsWakingServer(true);
          },
        }
      );

      const nowTime = new Date().toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const userVoiceMsg: ChatMessage = {
        id: `uv-${Date.now()}`,
        role: 'user',
        content: result.transcript,
        timestamp: nowTime,
        isVoiceNote: true,
        voiceDurationSeconds: durationSec,
      };

      const twinAnalysisMsg: ChatMessage = {
        id: `tv-${Date.now() + 1}`,
        role: 'twin',
        content: result.twinReply,
        timestamp: nowTime,
        isVoiceNote: true,
        voiceSummary: result.summary,
        extractedTasks: result.extractedTasks,
        extractedEvents: result.extractedEvents,
        tasksImported: false,
      };

      setMessages((prev) => [...prev, userVoiceMsg, twinAnalysisMsg]);
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      setVoiceError(err.message || 'تعذر تحويل الملاحظة الصوتية، يرجى المحاولة مرة أخرى.');
    } finally {
      if (activeRequestAbortRef.current === controller) {
        activeRequestAbortRef.current = null;
      }
      setIsProcessingVoice(false);
      setIsWakingServer(false);
    }
  };

  const startRecording = async () => {
    setVoiceError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('متصفحك لا يدعم تسجيل الصوت المباشر. يمكنك رفع ملف صوتي بدلاً من ذلك.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      recordingDurationRef.current = 0;

      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMimeType = preferredMimeTypes.find(
        (type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)
      );

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const wasCancelled = cancelRecordingRef.current;
        const duration = recordingDurationRef.current;
        const mime = recorder.mimeType || 'audio/webm';
        const chunks = audioChunksRef.current;
        cleanupRecordingResources();
        setIsRecording(false);
        setRecordingSeconds(0);

        if (wasCancelled || chunks.length === 0) return;

        const audioBlob = new Blob(chunks, { type: mime });
        if (audioBlob.size < 500) {
          setVoiceError('التسجيل قصير جداً، يرجى التحدث لمدة ثانية واحدة على الأقل.');
          return;
        }
        await handleAudioBlobSubmit(audioBlob, Math.max(1, duration));
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      cleanupRecordingResources();
      setIsRecording(false);
      setVoiceError('تعذر الوصول للميكروفون. يرجى منح إذن الميكروفون أو رفع ملف صوتي.');
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      cancelRecordingRef.current = false;
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecordingResources();
      setIsRecording(false);
      setRecordingSeconds(0);
    }
  };

  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await handleAudioBlobSubmit(file, 0);
  };

  const handleImportMessageTasks = (msgId: string, extTasks: Partial<Task>[], extEvents: Partial<TimeBlock>[]) => {
    onAddExtractedTasks(extTasks, extEvents);
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, tasksImported: true } : m))
    );
  };

  const handleImportMessageGoals = (msgId: string, extGoals: Partial<LongTermGoal>[]) => {
    if (!onAddGoal || extGoals.length === 0) return;
    extGoals.forEach((g) => {
      onAddGoal({
        title: g.title || 'هدف جديد',
        category: (g.category as LongTermGoal['category']) || 'work',
        progress: typeof g.progress === 'number' ? g.progress : 0,
        targetDate: g.targetDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      });
    });
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, goalsImported: true } : m))
    );
  };

  const handleTriggerSuggestedAction = (action: NonNullable<ChatMessage['suggestedAction']>) => {
    if (action.type === 'start_focus') {
      const matched =
        (action.taskId && tasks.find((t) => t.id === action.taskId)) ||
        tasks.find((t) => t.status !== 'completed');
      onStartFocus(matched);
      return;
    }
    if (action.type === 'open_schedule') {
      onNavigateTab('schedule');
      return;
    }
    if (action.type === 'open_tasks') {
      onNavigateTab('tasks');
      return;
    }
    if (action.type === 'optimize_schedule') {
      onOptimizeSchedule?.();
      onNavigateTab('schedule');
    }
  };

  const handleResetChat = () => {
    activeRequestAbortRef.current?.abort();
    activeRequestAbortRef.current = null;
    setIsLoading(false);
    setIsProcessingVoice(false);
    setIsWakingServer(false);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
    setVoiceError(null);
    setMessages([buildInitialMessage()]);
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useModalScrollLock('chat-drawer', isOpen);

  if (!isOpen) return null;

  const quickPrompts = [
    'ما هي أولويتي القصوى الآن؟',
    'أضف مهمة جديدة ونظّم وقتها اليوم',
    'اقترح خطة يومي مع ورد القرآن والأذكار',
    'أعد تنظيم ما تبقى من يومي بذكاء',
    'ساعدني في التقدم بأهدافي بعيدة المدى',
  ];

  return (
    <div
      className="app-modal-overlay sm:justify-end bg-slate-950/80 backdrop-blur-sm sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="app-modal-panel max-w-lg h-[min(640px,85dvh)] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Sticky Header with Always-Visible Close (X) */}
        <div className="app-modal-header p-4 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950/95 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-emerald-500 p-0.5 shadow-md shadow-cyan-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <BrainCircuit className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                <span>المساعد الرقمي AI</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-700/50">
                  ذكاء متكامل
                </span>
              </h3>
              <p className="text-[11px] text-emerald-400 font-medium truncate">
                {isLoading || isProcessingVoice
                  ? 'جاري الاتصال بالمساعد...'
                  : 'تحليل المهام • جدولة ذكية • صوت ونص'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetChat}
              className="p-2 rounded-full bg-slate-800/80 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 transition-colors cursor-pointer"
              title="بدء محادثة جديدة"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="app-modal-close p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="shrink-0 p-3 border-b border-slate-800/80 bg-slate-900/60 overflow-x-auto flex items-center gap-1.5 no-scrollbar">
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isLoading || isProcessingVoice}
              onClick={() => handleSendMessage(prompt)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 hover:text-cyan-300 border border-slate-700/80 text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Feed */}
        <div className="app-modal-body p-4 space-y-4">
          {messages.map((msg) => {
            const isTwin = msg.role === 'twin';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isTwin ? 'items-start' : 'items-start flex-row-reverse'}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                    isTwin
                      ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                      : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                  }`}
                >
                  {isTwin ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-2.5 ${
                    isTwin
                      ? 'bg-slate-950 border border-slate-800 text-slate-200 shadow-md'
                      : 'bg-cyan-600 text-white shadow-md'
                  }`}
                >
                  {/* User Voice Note Badge */}
                  {!isTwin && msg.isVoiceNote && (
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cyan-700/80 border border-cyan-400/30 text-[10px] font-semibold text-cyan-100">
                      <Mic className="w-3 h-3" />
                      <span>
                        ملاحظة صوتية مفرغة
                        {msg.voiceDurationSeconds ? ` • ${formatDuration(msg.voiceDurationSeconds)}` : ''}
                      </span>
                    </div>
                  )}

                  {/* Twin Voice Note Summary Card */}
                  {isTwin && msg.voiceSummary && (
                    <div className="p-2.5 rounded-xl bg-indigo-950/50 border border-indigo-800/60 space-y-1">
                      <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        ملخص الملاحظة الصوتية:
                      </span>
                      <p className="text-[11px] text-slate-200 leading-relaxed font-medium">
                        {msg.voiceSummary}
                      </p>
                    </div>
                  )}

                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Extracted Tasks & Events from Voice Note */}
                  {isTwin &&
                    ((msg.extractedTasks && msg.extractedTasks.length > 0) ||
                      (msg.extractedEvents && msg.extractedEvents.length > 0)) && (
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-900/50 space-y-2">
                        <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                          <CheckSquare className="w-3.5 h-3.5" />
                          المهام والمواعيد المستخرجة ({(msg.extractedTasks?.length || 0) + (msg.extractedEvents?.length || 0)}):
                        </span>

                        <div className="space-y-1.5">
                          {msg.extractedTasks?.map((t, idx) => (
                            <div
                              key={`vt-${idx}`}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]"
                            >
                              <span className="text-slate-100 font-medium truncate">{t.title}</span>
                              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                                {t.estimatedMinutes || 30} د
                              </span>
                            </div>
                          ))}

                          {msg.extractedEvents?.map((ev, idx) => (
                            <div
                              key={`ve-${idx}`}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]"
                            >
                              <span className="text-slate-100 font-medium truncate flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
                                {ev.title}
                              </span>
                              <span className="text-[10px] font-mono text-cyan-300 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                                {ev.startTime} - {ev.endTime}
                              </span>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          disabled={msg.tasksImported}
                          onClick={() =>
                            handleImportMessageTasks(
                              msg.id,
                              msg.extractedTasks || [],
                              msg.extractedEvents || []
                            )
                          }
                          className={`w-full py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            msg.tasksImported
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 cursor-default'
                              : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
                          }`}
                        >
                          {msg.tasksImported ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تم إدراج المهام والمواعيد في النظام</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>إدراج المهام المستخرجة في جدولي</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  
                  {/* Suggested Goals from AI Assistant */}
                  {isTwin && msg.suggestedGoals && msg.suggestedGoals.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-indigo-800/50 space-y-2">
                      <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        أهداف مقترحة ({msg.suggestedGoals.length}):
                      </span>
                      <div className="space-y-1.5">
                        {msg.suggestedGoals.map((g, idx) => (
                          <div
                            key={`sg-${idx}`}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]"
                          >
                            <span className="text-slate-100 font-medium truncate">{g.title}</span>
                            {g.targetDate && (
                              <span className="text-[10px] font-mono text-indigo-300 bg-slate-800 px-1.5 py-0.5 rounded shrink-0">
                                {g.targetDate}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {onAddGoal && (
                        <button
                          type="button"
                          disabled={msg.goalsImported}
                          onClick={() => handleImportMessageGoals(msg.id, msg.suggestedGoals || [])}
                          className={`w-full py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            msg.goalsImported
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 cursor-default'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                          }`}
                        >
                          {msg.goalsImported ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>تمت إضافة الأهداف بعيدة المدى</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>إضافة إلى أهدافي بعيدة المدى</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quick Executable Suggested Action */}
                  {isTwin && msg.suggestedAction && msg.suggestedAction.type !== 'none' && (
                    <button
                      type="button"
                      onClick={() => handleTriggerSuggestedAction(msg.suggestedAction!)}
                      className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-cyan-500/20 hover:from-amber-500/30 hover:to-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {msg.suggestedAction.type === 'start_focus' ? (
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                      ) : msg.suggestedAction.type === 'optimize_schedule' ? (
                        <Wand2 className="w-3.5 h-3.5 text-cyan-300" />
                      ) : (
                        <Calendar className="w-3.5 h-3.5 text-cyan-300" />
                      )}
                      <span>{msg.suggestedAction.label || 'تنفيذ الإجراء المقترح'}</span>
                    </button>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/40 text-[10px] text-slate-400">
                    <span>{msg.timestamp}</span>
                    {isTwin && (
                      <button
                        onClick={() => speakText(msg.content)}
                        className="hover:text-cyan-300 transition-colors p-1 cursor-pointer"
                        title="قراءة صوتية"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {(isLoading || isProcessingVoice) && (
            <div className="flex gap-3 items-start" role="status" aria-live="polite">
              <div className="w-7 h-7 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-pulse" />
              </div>
              <div className="bg-slate-950 border border-cyan-900/60 rounded-2xl p-3.5 text-xs text-slate-200 space-y-2 max-w-[85%] shadow-md">
                <div className="flex items-center gap-2 font-semibold text-cyan-300">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
                  <span>
                    {isProcessingVoice
                      ? 'جاري الاتصال بالمساعد وتحليل الملاحظة الصوتية...'
                      : 'جاري الاتصال بالمساعد...'}
                  </span>
                </div>

                {(isWakingServer || loadingElapsedSec >= 3) && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {isWakingServer
                        ? 'الخادم قيد الاستيقاظ من وضع السكون، ننتظر الاستجابة تلقائياً...'
                        : 'يرجى الانتظار، قد يستغرق إيقاظ الخادم حتى 60 ثانية.'}
                      <span className="inline-block mr-1.5 font-mono text-cyan-400 font-bold">
                        ({loadingElapsedSec} / 60 ث)
                      </span>
                    </p>
                    <div className="w-full h-1 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((loadingElapsedSec / 60) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Voice Error Banner */}
        {voiceError && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-rose-950/70 border border-rose-800/70 text-[11px] text-rose-200 flex items-center justify-between gap-2">
            <span>{voiceError}</span>
            <button
              type="button"
              onClick={() => setVoiceError(null)}
              className="text-rose-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Input / Voice Recording Bar */}
        {isRecording ? (
          <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-rose-950/30 border-t border-rose-800/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <span className="text-xs font-bold text-rose-300 font-mono">
                {formatDuration(recordingSeconds)}
              </span>
              <span className="text-xs text-slate-200">جاري تسجيل ملاحظتك الصوتية...</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 cursor-pointer"
                title="إلغاء التسجيل"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>إلغاء</span>
              </button>

              <button
                type="button"
                id="btn-stop-send-voice"
                onClick={stopAndSendRecording}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                title="إيقاف وتحويل الصوت إلى مهام"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>إرسال وتحليل</span>
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-slate-950 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleAudioFileUpload}
              className="hidden"
            />

            <button
              type="button"
              id="btn-record-voice-note"
              disabled={isLoading || isProcessingVoice}
              onClick={startRecording}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 text-cyan-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/70 disabled:opacity-40 transition-all cursor-pointer"
              title="تسجيل ملاحظة صوتية وتلخيص المهام"
            >
              <Mic className="w-4 h-4" />
            </button>

            <button
              type="button"
              id="btn-upload-voice-note"
              disabled={isLoading || isProcessingVoice}
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 border border-slate-700 disabled:opacity-40 transition-all cursor-pointer"
              title="رفع ملف صوتي لتحويله إلى نص ومهام"
            >
              <FileAudio className="w-4 h-4" />
            </button>

            <input
              type="text"
              placeholder="اسأل المساعد الرقمي AI أو اطلب خطة ومهام..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isProcessingVoice}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading || isProcessingVoice}
              className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white transition-all cursor-pointer"
              title={isLoading || isProcessingVoice ? 'جاري الاتصال بالمساعد...' : 'إرسال'}
            >
              {isLoading || isProcessingVoice ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 rotate-180" />
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
