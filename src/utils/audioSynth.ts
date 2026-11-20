// Simple and reliable Web Audio & Quran Ambient Generator for Focus Mode

export interface QuranReciterPreset {
  id: 'ar.alafasy' | 'ar.abdulbasitmurattal';
  label: string;
}

export interface QuranSurahPreset {
  id: number;
  name: string;
}

export const QURAN_RECITERS: QuranReciterPreset[] = [
  { id: 'ar.alafasy', label: 'مشاري العفاسي (صوت عذب ندي)' },
  { id: 'ar.abdulbasitmurattal', label: 'عبدالباسط عبدالصمد (ترتيل هادئ)' },
];

export const QURAN_SURAH_PRESETS: QuranSurahPreset[] = [
  { id: 55, name: 'سورة الرحمن' },
  { id: 67, name: 'سورة الملك' },
  { id: 18, name: 'سورة الكهف' },
  { id: 36, name: 'سورة يس' },
  { id: 2, name: 'سورة البقرة' },
];

export type AlertToneId =
  | 'chime_classic'
  | 'calm_spiritual'
  | 'work_crisp'
  | 'urgent_pulse'
  | 'study_bell'
  | 'health_water'
  | 'personal_warm'
  | 'silent';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private currentSource: AudioNode | null = null;
  private gainNode: GainNode | null = null;
  private quranAudio: HTMLAudioElement | null = null;
  private isPlaying = false;
  private currentType: string | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private scheduleNote(
    startTime: number,
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    peakGain = 0.18
  ) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  // Play distinct synthesized alert tone by preset ID
  public playTone(toneId: AlertToneId) {
    if (toneId === 'silent') return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      switch (toneId) {
        case 'calm_spiritual': {
          // Warm spiritual pentatonic resonance (D4 -> A4 -> F#5 -> A5)
          this.scheduleNote(now, 293.66, 0.9, 'sine', 0.12);
          this.scheduleNote(now + 0.18, 440.0, 0.95, 'sine', 0.13);
          this.scheduleNote(now + 0.38, 587.33, 1.1, 'sine', 0.14);
          this.scheduleNote(now + 0.58, 659.25, 1.25, 'sine', 0.1);
          break;
        }
        case 'work_crisp': {
          // Crisp two-step business alert (G5 -> B5 -> D6)
          this.scheduleNote(now, 783.99, 0.16, 'triangle', 0.16);
          this.scheduleNote(now + 0.14, 987.77, 0.22, 'triangle', 0.16);
          this.scheduleNote(now + 0.34, 1174.66, 0.35, 'sine', 0.18);
          break;
        }
        case 'urgent_pulse': {
          // High-awareness 3-pulse urgent chime (A5-E5 alternating)
          this.scheduleNote(now, 880.0, 0.18, 'triangle', 0.22);
          this.scheduleNote(now + 0.22, 1046.5, 0.18, 'triangle', 0.22);
          this.scheduleNote(now + 0.44, 880.0, 0.18, 'triangle', 0.22);
          this.scheduleNote(now + 0.66, 1174.66, 0.42, 'triangle', 0.24);
          break;
        }
        case 'study_bell': {
          // Harmonic crystal bell (C5 + G5 + E6)
          this.scheduleNote(now, 523.25, 0.75, 'sine', 0.14);
          this.scheduleNote(now + 0.06, 783.99, 0.85, 'sine', 0.14);
          this.scheduleNote(now + 0.14, 1318.51, 0.9, 'sine', 0.1);
          break;
        }
        case 'health_water': {
          // Fresh ascending droplet arpeggio (E5 -> G5 -> A5 -> C6)
          this.scheduleNote(now, 659.25, 0.22, 'sine', 0.14);
          this.scheduleNote(now + 0.12, 783.99, 0.24, 'sine', 0.15);
          this.scheduleNote(now + 0.24, 880.0, 0.3, 'sine', 0.15);
          this.scheduleNote(now + 0.36, 1046.5, 0.55, 'sine', 0.16);
          break;
        }
        case 'personal_warm': {
          // Gentle marimba-like double chime (F4 -> A4 -> C5)
          this.scheduleNote(now, 349.23, 0.35, 'triangle', 0.15);
          this.scheduleNote(now + 0.16, 440.0, 0.4, 'sine', 0.15);
          this.scheduleNote(now + 0.32, 523.25, 0.65, 'sine', 0.16);
          break;
        }
        case 'chime_classic':
        default: {
          this.playChime(true);
          break;
        }
      }
    } catch (e) {
      console.warn('Audio tone playback failed', e);
    }
  }

  // Play gentle bell sound on task complete / timer finish
  public playChime(success = true) {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const now = this.ctx.currentTime;
      osc.type = 'sine';
      if (success) {
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5
        osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.3); // G5
        osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.45); // C6
      } else {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.3);
      }

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.2);
    } catch (e) {
      console.warn('Audio chime failed', e);
    }
  }

  // Play Ambient focus noise (rain / white noise / binaural waves)
  public startAmbient(type: 'whitenoise' | 'rain' | 'waves' | 'binaural', volume = 0.3) {
    try {
      this.stopAmbient();
      this.initCtx();
      if (!this.ctx) return;

      this.currentType = type;
      this.isPlaying = true;

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      this.gainNode.connect(this.ctx.destination);

      if (type === 'whitenoise' || type === 'rain') {
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);

        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (type === 'rain') {
            // Pink/Brownish noise for soft rain
            output[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5;
          } else {
            output[i] = white * 0.15;
          }
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        if (type === 'rain') {
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, this.ctx.currentTime);
          whiteNoise.connect(filter);
          filter.connect(this.gainNode);
        } else {
          whiteNoise.connect(this.gainNode);
        }

        whiteNoise.start();
        this.currentSource = whiteNoise;
      } else if (type === 'binaural' || type === 'waves') {
        // Binaural alpha waves 432Hz + 442Hz (10Hz alpha difference)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'sine';

        osc1.frequency.setValueAtTime(216, this.ctx.currentTime);
        osc2.frequency.setValueAtTime(226, this.ctx.currentTime);

        const merger = this.ctx.createChannelMerger(2);
        osc1.connect(merger, 0, 0);
        osc2.connect(merger, 0, 1);

        merger.connect(this.gainNode);
        osc1.start();
        osc2.start();

        this.currentSource = osc1;
      }
    } catch (e) {
      console.warn('Ambient start failed', e);
    }
  }

  // Play serene Quran recitation as Focus Ambient audio
  public startQuranAmbient(
    surahId = 55,
    reciterId: 'ar.alafasy' | 'ar.abdulbasitmurattal' = 'ar.alafasy',
    volume = 0.3,
    onError?: (message: string) => void
  ) {
    try {
      this.stopAmbient();

      const audioUrl = `https://cdn.islamic.network/quran/audio-surah/128/${reciterId}/${surahId}.mp3`;
      const audio = new Audio(audioUrl);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = Math.max(0, Math.min(1, volume));

      audio.onerror = () => {
        onError?.('تعذر تشغيل تلاوة القرآن الآن. تحقق من اتصال الإنترنت وحاول مرة أخرى.');
      };

      this.quranAudio = audio;
      this.currentType = 'quran';
      this.isPlaying = true;

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          onError?.('تعذر بدء تشغيل الصوت تلقائياً، يرجى المحاولة مرة أخرى.');
        });
      }
    } catch (e) {
      console.warn('Quran ambient start failed', e);
      onError?.('حدث خطأ أثناء تشغيل صوت القرآن الكريم.');
    }
  }

  public stopAmbient() {
    try {
      if (this.currentSource) {
        (this.currentSource as any).stop?.();
        this.currentSource.disconnect();
        this.currentSource = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.quranAudio) {
        this.quranAudio.pause();
        this.quranAudio.currentTime = 0;
        this.quranAudio.src = '';
        this.quranAudio = null;
      }
      this.isPlaying = false;
      this.currentType = null;
    } catch (e) {
      // ignore
    }
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
    if (this.quranAudio) {
      this.quranAudio.volume = clamped;
    }
  }

  public getIsPlaying() {
    return this.isPlaying;
  }

  public getCurrentType() {
    return this.currentType;
  }
}

export const soundEngine = new SoundEngine();
