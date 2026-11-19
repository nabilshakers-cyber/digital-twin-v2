import { useState, useRef, useEffect, useCallback } from 'react';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstanceLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstanceLike, ev: Event) => unknown) | null;
  onresult: ((this: SpeechRecognitionInstanceLike, ev: SpeechRecognitionEventLike) => unknown) | null;
  onerror: ((this: SpeechRecognitionInstanceLike, ev: SpeechRecognitionErrorEventLike) => unknown) | null;
  onend: ((this: SpeechRecognitionInstanceLike, ev: Event) => unknown) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function mapSpeechErrorToArabic(errorCode: string): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'تم رفض إذن الميكروفون. يرجى السماح بالوصول إلى الميكروفون من إعدادات التطبيق أو المتصفح.';
    case 'no-speech':
      return 'لم يتم التقاط أي كلام واضح. حاول الاقتراب من الميكروفون والتحدث بوضوح.';
    case 'audio-capture':
      return 'لم يتم العثور على ميكروفون متصل بهذا الجهاز.';
    case 'network':
      return 'حدث خطأ في الشبكة أثناء الاتصال بخدمة التعرف على الكلام.';
    case 'aborted':
      return '';
    default:
      return 'تعذر التعرف على الصوت، يرجى المحاولة مرة أخرى.';
  }
}

async function ensureMicrophoneAccess(): Promise<{ ok: boolean; message?: string }> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { ok: true };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err: any) {
    const name = err?.name || '';
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, message: 'لم يتم العثور على ميكروفون متصل بهذا الجهاز.' };
    }
    return {
      ok: false,
      message:
        'تم رفض إذن الميكروفون. يرجى السماح للتطبيق بالوصول إلى الميكروفون من أذونات الجهاز ثم المحاولة مجدداً.',
    };
  }
}

export interface UseWebSpeechOptions {
  lang?: 'ar-SA' | 'en-US';
  continuous?: boolean;
  onFinalTranscript?: (finalText: string) => void;
}

export function useWebSpeech(options: UseWebSpeechOptions = {}) {
  const { lang: initialLang = 'ar-SA', continuous = false, onFinalTranscript } = options;

  const [isSupported] = useState<boolean>(() => Boolean(getSpeechRecognitionCtor()));
  const [lang, setLang] = useState<'ar-SA' | 'en-US'>(initialLang);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const finalBufferRef = useRef<string>('');
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        setIsListening(false);
      }
    }
  }, []);

  const startListening = useCallback(
    async (overrideLang?: 'ar-SA' | 'en-US') => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        setError('متصفحك الحالي لا يدعم واجهة Web Speech API للتعرف المباشر على الكلام.');
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      setError(null);
      setInterimTranscript('');
      finalBufferRef.current = '';

      // Explicitly prompt runtime microphone permission on Android WebView & browsers first
      const perm = await ensureMicrophoneAccess();
      if (!perm.ok) {
        setError(
          perm.message ||
            'تم رفض إذن الميكروفون. يرجى السماح بالوصول إلى الميكروفون من إعدادات التطبيق.'
        );
        setIsListening(false);
        return;
      }

      const recognition = new Ctor();
      recognition.lang = overrideLang || lang;
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
        let confirmed = '';
        let interim = '';

        for (let i = 0; i < event.results.length; i += 1) {
          const result = event.results[i];
          const textPiece = result[0]?.transcript || '';
          if (result.isFinal) {
            confirmed += `${textPiece} `;
          } else {
            interim += textPiece;
          }
        }

        const cleanConfirmed = confirmed.trim();
        if (cleanConfirmed) {
          finalBufferRef.current = cleanConfirmed;
          setTranscript(cleanConfirmed);
        }
        setInterimTranscript(interim.trim());
      };

      recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
        const msg = mapSpeechErrorToArabic(event.error);
        if (msg) setError(msg);
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        const finalText = finalBufferRef.current.trim();
        if (finalText && onFinalRef.current) {
          onFinalRef.current(finalText);
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        setError('تعذر بدء التسجيل الصوتي، يرجى المحاولة مرة أخرى.');
        setIsListening(false);
      }
    },
    [lang, continuous]
  );

  const resetSpeech = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    finalBufferRef.current = '';
  }, []);

  return {
    isSupported,
    lang,
    setLang,
    isListening,
    transcript,
    setTranscript,
    interimTranscript,
    error,
    setError,
    startListening,
    stopListening,
    resetSpeech,
  };
}
