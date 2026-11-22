import express from "express";
import cors from 'cors';
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

const corsOptions: cors.CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: "15mb" }));

// Initialize Google GenAI lazily or check key before requests
function getAiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("مفتاح GEMINI_API_KEY غير مهيأ على الخادم. يرجى إضافته في إعدادات الأسرار (Settings > Secrets).");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

let primaryCooldownUntil = 0;

async function generateContentSmart(
  label: string,
  params: {
    contents: any;
    systemInstruction?: string;
    thinkingLevel?: ThinkingLevel;
    responseMimeType?: string;
    responseSchema?: any;
  },
  primaryTimeoutMs = 8_000,
  fallbackTimeoutMs = 25_000
) {
  const ai = getAiClient();

  const buildConfig = (isPrimary: boolean, signal: AbortSignal) => {
    const cfg: Record<string, any> = { abortSignal: signal };
    if (params.systemInstruction) cfg.systemInstruction = params.systemInstruction;
    if (params.responseMimeType) cfg.responseMimeType = params.responseMimeType;
    if (params.responseSchema) cfg.responseSchema = params.responseSchema;
    if (isPrimary && params.thinkingLevel) {
      cfg.thinkingConfig = { thinkingLevel: params.thinkingLevel };
    }
    return cfg;
  };

  // Attempt 1: Primary model (gemini-4-hydrogen) unless in brief cooldown after 503/timeout
  if (Date.now() >= primaryCooldownUntil) {
    const primaryCtrl = new AbortController();
    const primaryTimer = setTimeout(() => primaryCtrl.abort(), primaryTimeoutMs);
    const t0 = Date.now();
    try {
      const res = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: params.contents,
        config: buildConfig(true, primaryCtrl.signal),
      });
      console.info(`[Gemini] ${label} (gemini-4-hydrogen) completed in ${Date.now() - t0}ms`);
      return res;
    } catch (primaryErr: any) {
      const primaryElapsed = Date.now() - t0;
      primaryCooldownUntil = Date.now() + 60_000;
      console.warn(
        `[Gemini] ${label} primary gemini-4-hydrogen failed after ${primaryElapsed}ms (${primaryErr?.status || primaryErr?.name || "err"}: ${primaryErr?.message || primaryErr}). Cooling down 60s and falling back to gemini-3.1-flash-lite...`
      );
    } finally {
      clearTimeout(primaryTimer);
    }
  } else {
    console.info(`[Gemini] ${label} using gemini-3.1-flash-lite during primary cooldown`);
  }

  // Attempt 2: Fast active fallback model (gemini-3.1-flash-lite)
  const fallbackCtrl = new AbortController();
  const fallbackTimer = setTimeout(() => fallbackCtrl.abort(), fallbackTimeoutMs);
  const t1 = Date.now();
  try {
    const fallbackRes = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: params.contents,
      config: buildConfig(false, fallbackCtrl.signal),
    });
    console.info(`[Gemini] ${label} (gemini-3.1-flash-lite fallback) completed in ${Date.now() - t1}ms`);
    return fallbackRes;
  } catch (fallbackErr: any) {
    console.error(
      `[Gemini] ${label} fallback also failed after ${Date.now() - t1}ms:`,
      fallbackErr
    );
    throw fallbackErr;
  } finally {
    clearTimeout(fallbackTimer);
  }
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Runtime Google Maps Platform config (reads provisioned env var if not exposed via VITE_ at build time)
app.get("/api/maps-config", (_req, res) => {
  const apiKey = (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ""
  ).trim();
  res.json({ apiKey });
});

// Digital Twin Chat & Guidance
app.post("/api/twin/chat", async (req, res) => {
  try {
    const { message, history, profile, tasks, schedule, context } = req.body;

    const systemInstruction = `
أنت "النسخة الرقمية الذكية" (Digital Twin / التوأم الرقمي) للمستخدم ${profile?.name || "المستخدم"}.
دورك الأساسي هو أن تكون عقله الثاني ومدير مهامه وجدوله اليومي، تفكر بنفس منطقه وأهدافه وتحميه من التشتت والتسويف والإرهاق.

معلومات ملف التوأم الرقمي:
- الاسم: ${profile?.name || "مستخدم"}
- المهنة/الدور: ${profile?.role || "مستقل / محترف"}
- ساعات ذروة الطاقة: ${profile?.peakEnergy || "صباحية (8:00 ص - 1:00 م)"}
- أسلوب العمل: ${profile?.workStyle || "جلسات تركيز عميق 50 دقيقة"}
- الأهداف الأساسية: ${profile?.mainGoals || "إنجاز المشاريع الحالية والمحافظة على التوازن"}
- أسلوب الحديث المطلوب: ${profile?.tone || "حازم، ذكي، مشجع وواقعي"}
- قواعدك الذهبية: ${profile?.rules || "لا تؤجل أهم مهمة في اليوم، خذ فترات راحة حقيقية"}

المهام الحالية في النظام:
${JSON.stringify(tasks || [], null, 2)}

الجدول الزمني لليوم:
${JSON.stringify(schedule || [], null, 2)}

سياق إضافي: ${context || "محادثة عامة"}

تعليمات الرد:
1. تحدث دائماً بضمير التوأم المتطابق/المستشار الداخلي المقرب (مثلاً: "بصفتي نسختك الرقمية..."، "معاً سننهي هذا..."، "بناءً على وتيرة طاقتنا اليوم...").
2. اجعل إجاباتك عملية، واضحة، مرتبة بنقاط، وباللغة العربية الفصحى السلسة والمشجعة.
3. إذا طلب المستخدم رأيك في ما يبدأ به الآن، انظر لمهامه وجدوله وأعطه خطوة فورية محددة.
4. إذا كان محبطاً أو مشتتاً، كن داعماً واقترح تقليص الحمل الذهني.
5. يمكنك اقتراح إضافة مهام جديدة أو تعديل أوقات إذا تطلب الأمر.
`;

    // Construct contents
    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }],
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await generateContentSmart("/api/twin/chat", {
      contents,
      systemInstruction,
      thinkingLevel: ThinkingLevel.LOW,
    });

    res.json({
      reply: response.text || "أنا هنا معك، دعنا نراجع مهامك ونرتب أولوياتنا اليوم.",
    });
  } catch (error: any) {
    console.error("Error in /api/twin/chat:", error);
    res.status(500).json({ error: error.message || "فشل الاتصال بالتوأم الرقمي" });
  }
});

// Auto-Optimize Daily Schedule
app.post("/api/twin/optimize-schedule", async (req, res) => {
  try {
    const { tasks, fixedEvents, profile, date, targetWorkHours } = req.body;

    const prompt = `
بصفتك النسخة الرقمية ومدير المهام الذكي للمستخدم (${profile?.name || "المستخدم"})، قم ببناء وتحسين الجدول الزمني اليومي الكامل ليوم (${date || "اليوم"}).

معلومات المستخدم وتفضيلاته:
- ذروة الإنتاجية والتركيز: ${profile?.peakEnergy || "صباحي"}
- أسلوب العمل: ${profile?.workStyle || "تركيز 45 دقيقة + راحة 10 دقائق"}
- ساعات العمل المستهدفة: ${targetWorkHours || "6 إلى 8 ساعات"}

المهام المطلوب إدراجها وجدولتها:
${JSON.stringify(tasks || [], null, 2)}

المواعيد والأحداث الثابتة (لا يمكن تغيير وقتها):
${JSON.stringify(fixedEvents || [], null, 2)}

قواعد بناء الجدول المثالي:
1. ضع المهام ذات التركيز العالي (Deep Work) في ساعات ذروة الطاقة.
2. احترم المواعيد الثابتة بالدقيقة.
3. وزع فترات راحة حقيقية ووجبات طعام وتجديد نشاط لتجنب الإرهاق.
4. خصص نهاية اليوم لمراجعة سريعة وإغلاق المهام والتخطيط للغد.
5. أرجع النتيجة بتنسيق JSON مطابق للمخطط المطلوب، مع تقديم نصائح موجزة وخطة عمل ذكية.
`;

    const response = await generateContentSmart(
      "/api/twin/optimize-schedule",
      {
        contents: prompt,
        thinkingLevel: ThinkingLevel.MEDIUM,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "ملخص تحليلي لخطة اليوم ونظرة التوأم الرقمي",
            },
            energyStrategy: {
              type: Type.STRING,
              description: "استراتيجية إدارة الطاقة لليوم",
            },
            timeBlocks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  startTime: { type: Type.STRING, description: "صيغة 24 ساعة مثل 08:30" },
                  endTime: { type: Type.STRING, description: "صيغة 24 ساعة مثل 09:30" },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  category: {
                    type: Type.STRING,
                    description: "deep_work | meeting | routine | health | personal | review",
                  },
                  relatedTaskId: { type: Type.STRING, description: "معرف المهمة إذا كانت مرتبطة بمهمة" },
                  priority: { type: Type.STRING, description: "high | medium | low" },
                  energyLevel: { type: Type.STRING, description: "high | medium | low" },
                  iconName: { type: Type.STRING },
                },
                required: ["id", "startTime", "endTime", "title", "category", "priority"],
              },
            },
            topPriorities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "أهم 3 أولويات لا تقبل التأجيل لليوم",
            },
            warnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "تنبيهات حول أي ضغط محتمل أو تضارب في الوقت",
            },
          },
          required: ["summary", "timeBlocks", "topPriorities"],
        },
      },
      15_000
    );

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Error in /api/twin/optimize-schedule:", error);
    res.status(500).json({ error: error.message || "فشل تحسين الجدول الزمني" });
  }
});

// Break Down Complex Task
app.post("/api/twin/breakdown-task", async (req, res) => {
  try {
    const { taskTitle, taskDescription, estimatedHours, profile } = req.body;

    const prompt = `
بصفتك النسخة الرقمية لـ (${profile?.name || "المستخدم"})، فكك هذه المهمة الكبيرة أو المعقدة إلى خطوات تنفيذية واضحة وصغيرة تقلل المقاومة النفسية والتسويف:

عنوان المهمة: ${taskTitle}
التفاصيل: ${taskDescription || "لا توجد تفاصيل إضافية"}
الوقت التقديري الإجمالي: ${estimatedHours || "ساعتان"}

المطلوب:
1. تقسيم المهمة إلى 3 - 6 خطوات دقيقة وواضحة.
2. تحديد الوقت المتوقع لكل خطوة بالدقائق (مثال: 15، 25، 40 دقيقة).
3. تقديم نصيحة ذكية للبدء بأسهل خطوة لكسر الجمود.
`;

    const response = await generateContentSmart("/api/twin/breakdown-task", {
      contents: prompt,
      thinkingLevel: ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          breakdownOverview: { type: Type.STRING },
          quickWinTip: { type: Type.STRING, description: "أسرع حركة لكسر التسويف والبدء فوراً" },
          subtasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                estimatedMinutes: { type: Type.INTEGER },
                difficulty: { type: Type.STRING, description: "easy | medium | hard" },
                focusTip: { type: Type.STRING },
              },
              required: ["title", "estimatedMinutes", "difficulty"],
            },
          },
        },
        required: ["breakdownOverview", "subtasks", "quickWinTip"],
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Error in /api/twin/breakdown-task:", error);
    res.status(500).json({ error: error.message || "فشل تفكيك المهمة" });
  }
});

// Natural Language Quick Input Parser
app.post("/api/twin/parse-quick-entry", async (req, res) => {
  try {
    const { naturalText, currentDate } = req.body;
    const refDate = currentDate ? new Date(currentDate) : new Date();
    const todayIso = refDate.toISOString().split("T")[0];

    const prompt = `
قم بتحليل النص أو الأمر الصوتي المدخل التالي من المستخدم واستخرج منه المهام وجدول المواعيد بدقة:
النص: "${naturalText}"
تاريخ اليوم الميلادي: "${todayIso}" (التاريخ والوقت الكامل: "${refDate.toISOString()}")

استخرج:
1. المهام المطلوب إنجازها (extractedTasks): مع العنوان، الأولوية (high, medium, low)، التصنيف (work, personal, health, study, urgent)، المدة التقديرية بالدقائق، تاريخ الاستحقاق (YYYY-MM-DD)، ووقت الاستحقاق إن ذُكر (HH:MM بصيغة 24 ساعة).
2. المواعيد أو الأحداث المحددة بوقت (extractedEvents): وقت البداية والنهاية بصيغة 24 ساعة (HH:MM - إذا لم يُذكر وقت النهاية قدّره بإضافة 45 أو 60 دقيقة لوقت البداية)، العنوان، والتصنيف (deep_work, meeting, routine, health, personal, review).
`;

    const response = await generateContentSmart("/api/twin/parse-quick-entry", {
      contents: prompt,
      thinkingLevel: ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          extractedTasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, description: "high | medium | low" },
                category: { type: Type.STRING, description: "work | personal | health | study | urgent" },
                estimatedMinutes: { type: Type.INTEGER },
                dueDate: { type: Type.STRING },
                dueTime: { type: Type.STRING, description: "HH:MM 24h" },
              },
              required: ["title", "priority", "category"],
            },
          },
          extractedEvents: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                startTime: { type: Type.STRING, description: "صيغة 24 ساعة مثل 10:00" },
                endTime: { type: Type.STRING, description: "صيغة 24 ساعة مثل 11:30" },
                category: { type: Type.STRING },
              },
              required: ["title", "startTime", "endTime"],
            },
          },
          twinComment: { type: Type.STRING, description: "تعليق سريع ومختصر من التوأم الرقمي على ما تم إدراجه" },
        },
        required: ["extractedTasks", "extractedEvents", "twinComment"],
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Error in /api/twin/parse-quick-entry:", error);
    res.status(500).json({ error: error.message || "فشل استخراج المهام" });
  }
});

// Daily Briefing / Evening Debrief
app.post("/api/twin/briefing", async (req, res) => {
  try {
    const { type, profile, tasks, completedTasks, schedule } = req.body; // type: 'morning' | 'evening'

    const prompt = `
أنت التوأم الرقمي لـ (${profile?.name || "المستخدم"}).
المطلوب: توليد ${type === "evening" ? "جلسة مراجعة مسائية وتلخيص الإنجازات" : "موجز صباحي محفز وذكي لبدء اليوم بقوة"}.

حالة اليوم:
- إجمالي المهام: ${tasks?.length || 0}
- المهام المكتملة: ${completedTasks?.length || 0}
- قائمة المهام: ${JSON.stringify(tasks || [], null, 2)}
- الجدول الزمني: ${JSON.stringify(schedule || [], null, 2)}
- أسلوب التوأم: ${profile?.tone || "مشجع، واقعي، حازم وذكي"}

المطلوب إخراجه بتنسيق JSON:
- headline: عبارة افتتاحية قوية ومحفزة خاصة بـ ${profile?.name || "المستخدم"}
- mainAdvice: نصيحة استراتيجية ذهبية تركز على الطاقة والإنتاجية
- topPriorities: أهم أولويات أو إنجازات
- energyQuote: حكمة أو تشجيع قصير بطابع شخصي
`;

    const response = await generateContentSmart("/api/twin/briefing", {
      contents: prompt,
      thinkingLevel: ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          mainAdvice: { type: Type.STRING },
          topPriorities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          energyQuote: { type: Type.STRING },
          syncScore: { type: Type.INTEGER, description: "نسبة التوافق والإنجاز 0 - 100" },
        },
        required: ["headline", "mainAdvice", "topPriorities", "energyQuote"],
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Error in /api/twin/briefing:", error);
    res.status(500).json({ error: error.message || "فشل توليد التقرير" });
  }
});

// Voice Note Transcription + Summarization + Task Extraction
app.post("/api/twin/voice-note", async (req, res) => {
  try {
    const { audioBase64, mimeType, profile, tasks, schedule, currentDate } = req.body;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "لم يتم استلام بيانات صوتية صالحة" });
    }

    // Strip codec qualifiers like ";codecs=opus" so Gemini receives a clean IANA MIME type
    const cleanMimeType = (typeof mimeType === "string" && mimeType.split(";")[0].trim()) || "audio/webm";

    // Step 1: Transcribe pre-recorded audio using gemini-3.5-transcribe
    const audioPart = {
      inlineData: {
        mimeType: cleanMimeType,
        data: audioBase64,
      },
    };

    const ai = getAiClient();
    const transcribeCtrl = new AbortController();
    const transcribeTimer = setTimeout(() => transcribeCtrl.abort(), 25_000);
    let transcriptionResponse;
    try {
      transcriptionResponse = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            audioPart,
            {
              text: "قم بتفريغ هذا التسجيل الصوتي بدقة إلى نص عربي واضح (أو باللغة المنطوقة فيه) مع الحفاظ على جميع التفاصيل والمواعيد والمهام المذكورة دون اختصار.",
            },
          ],
        },
        config: { abortSignal: transcribeCtrl.signal },
      });
    } finally {
      clearTimeout(transcribeTimer);
    }

    const transcript = (transcriptionResponse.text ?? "").trim();

    if (!transcript) {
      return res.status(422).json({
        error: "تعذر التعرف على كلام واضح في التسجيل الصوتي، يرجى المحاولة مرة أخرى.",
      });
    }

    // Step 2: Summarize transcript & extract tasks/events
    const analysisPrompt = `
أنت "النسخة الرقمية الذكية" للمستخدم (${profile?.name || "المستخدم"}).
سجل المستخدم الملاحظة الصوتية التالية، وتم تفريغها إلى النص الآتي:
"${transcript}"

تاريخ ووقت الآن: "${currentDate || new Date().toISOString()}"
سياق المهام الحالية (عددها ${Array.isArray(tasks) ? tasks.length : 0}) والجدول (عدد كتله ${Array.isArray(schedule) ? schedule.length : 0}).

المطلوب:
1. كتابة ملخص قصير وواضح للملاحظة الصوتية (summary).
2. كتابة رد مختصر ومباشر من التوأم الرقمي يوجه المستخدم لما تم استخراجه وأول خطوة مقترحة (twinReply).
3. استخراج أي مهام (extractedTasks) ذُكرت في التسجيل الصوتي مع العنوان، الوصف المختصر، الأولوية (high | medium | low)، التصنيف (work | personal | health | study | urgent)، المدة التقديرية بالدقائق، وتاريخ/وقت الاستحقاق إن ذُكر (YYYY-MM-DD و HH:MM).
4. استخراج أي مواعيد أو اجتماعات محددة بوقت (extractedEvents) مع وقت البداية والنهاية بصيغة 24 ساعة (HH:MM).
`;

    const analysisResponse = await generateContentSmart("/api/twin/voice-note:analyze", {
      contents: analysisPrompt,
      thinkingLevel: ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "ملخص مركز ومفيد للملاحظة الصوتية باللغة العربية",
          },
          twinReply: {
            type: Type.STRING,
            description: "رد التوأم الرقمي على المستخدم بنبرة شخصية داعمة وعملية",
          },
          extractedTasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, description: "high | medium | low" },
                category: { type: Type.STRING, description: "work | personal | health | study | urgent" },
                estimatedMinutes: { type: Type.INTEGER },
                dueDate: { type: Type.STRING },
                dueTime: { type: Type.STRING },
              },
              required: ["title", "priority", "category"],
            },
          },
          extractedEvents: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                startTime: { type: Type.STRING },
                endTime: { type: Type.STRING },
                category: { type: Type.STRING },
              },
              required: ["title", "startTime", "endTime"],
            },
          },
        },
        required: ["summary", "twinReply", "extractedTasks", "extractedEvents"],
      },
    });

    const parsed = JSON.parse((analysisResponse.text ?? "{}").trim());

    res.json({
      transcript,
      summary: parsed.summary || transcript,
      twinReply: parsed.twinReply || "تم تحليل ملاحظتك الصوتية واستخراج النقاط الأساسية بنجاح.",
      extractedTasks: Array.isArray(parsed.extractedTasks) ? parsed.extractedTasks : [],
      extractedEvents: Array.isArray(parsed.extractedEvents) ? parsed.extractedEvents : [],
    });
  } catch (error: any) {
    console.error("Error in /api/twin/voice-note:", error);
    res.status(500).json({ error: error.message || "فشل معالجة الملاحظة الصوتية" });
  }
});

// Contextual Pre-Task Briefing
app.post("/api/twin/contextual-briefing", async (req, res) => {
  try {
    const { task, profile, schedule, goals } = req.body;

    if (!task || !task.id) {
      return res.status(400).json({ error: "بيانات المهمة مطلوبة لإنشاء الموجز السياقي" });
    }

    const prompt = `
بصفتك "النسخة الرقمية الذكية" للمستخدم (${profile?.name || "المستخدم"})، جهّز موجزاً سياقياً فورياً (Contextual Briefing) قبل أن يبدأ المستخدم العمل على المهمة التالية:

تفاصيل المهمة:
${JSON.stringify(task, null, 2)}

أسلوب المستخدم وقواعده:
- ذروة الطاقة: ${profile?.peakEnergy || "صباحي"}
- أسلوب العمل: ${profile?.workStyle || "جلسات تركيز 45 دقيقة"}
- القواعد: ${profile?.rules || ""}

الأهداف بعيدة المدى المرتبطة:
${JSON.stringify(goals || [], null, 2)}

الكتل الزمنية المحيطة في جدول اليوم:
${JSON.stringify(schedule || [], null, 2)}

المطلوب إخراجه بتنسيق JSON:
- summary: ملخص سياقي مكثف يوضح أهمية هذه المهمة، كيف ترتبط بأهداف المستخدم أو جدوله اليومي، والوضع الذهني المطلوب لإنجازها.
- keyNotes: مصفوفة من 3 إلى 4 نقاط مرجعية عملية (نقاط تركيز، مخاطر يجب تجنبها، أو تفاصيل مهمة من المهمة نفسها).
- suggestedAction: إجراء عملي فوري ومحدد يبدأ به المستخدم في أول دقيقتين لكسر الجمود.
`;

    const response = await generateContentSmart("/api/twin/contextual-briefing", {
      contents: prompt,
      thinkingLevel: ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyNotes: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          suggestedAction: { type: Type.STRING },
        },
        required: ["summary", "keyNotes", "suggestedAction"],
      },
    });

    const parsed = JSON.parse((response.text ?? "{}").trim());

    res.json({
      taskId: task.id,
      summary: parsed.summary || "هذه المهمة جزء أساسي من تقدمك اليوم نحو أهدافك.",
      keyNotes: Array.isArray(parsed.keyNotes) ? parsed.keyNotes : [],
      suggestedAction: parsed.suggestedAction || "ابدأ بتخصيص 25 دقيقة تركيز كاملة للخطوة الأولى دون مشتتات.",
    });
  } catch (error: any) {
    console.error("Error in /api/twin/contextual-briefing:", error);
    res.status(500).json({ error: error.message || "فشل توليد الموجز السياقي للمهمة" });
  }
});

// Auto-Classify Unclassified Tasks (Category & Priority) via Gemini API
app.post("/api/twin/classify-tasks", async (req, res) => {
  try {
    const { tasks, profile } = req.body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: "لا توجد مهام لإرسالها للتصنيف التلقائي" });
    }

    const compactTasks = tasks.slice(0, 40).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      estimatedMinutes: t.estimatedMinutes || 30,
      dueDate: t.dueDate || "",
      dueTime: t.dueTime || "",
    }));

    const prompt = `
بصفتك مساعد تنظيم ذكي للمستخدم (${profile?.name || "المستخدم"} - ${profile?.role || "محترف"})، قم بتحليل قائمة المهام التالية وتحديد التصنيف والأولوية الأنسب لكل مهمة بدقة.

أهداف المستخدم الرئيسية: ${profile?.mainGoals || "الإنتاجية والتوازن"}

التصنيفات المسموحة فقط (category):
- "work": أعمال ومشاريع واجتماعات وتقارير مهنية
- "personal": شؤون شخصية وعائلية ومنزلية وتسوق وعبادات
- "health": رياضة وصحة وتغذية وراحة ونوم ومواعيد طبية
- "study": تعلم وقراءة ودورات ومهارات ومذاكرة
- "urgent": أمور طارئة جداً أو التزامات حرجة فورية

الأولويات المسموحة فقط (priority):
- "high": عاجل وهام أو ذو أثر كبير أو موعد قريب حرج
- "medium": مهم بدرجة متوسطة أو عمل اعتيادي
- "low": مهمة خفيفة أو غير مستعجلة ويمكن تأجيلها

المهام المطلوب تصنيفها:
${JSON.stringify(compactTasks, null, 2)}

أعد النتيجة بصيغة JSON مطابقة للمخطط بحيث تشمل كل معرف (id) في القائمة مع category و priority وسبب مختصر بالعربية (reason)، بالإضافة إلى ملخص عام (summary).
`;

    const response = await generateContentSmart("/api/twin/classify-tasks", {
      contents: prompt,
      thinkingLevel: ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          classifications: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  description: "work | personal | health | study | urgent",
                },
                priority: {
                  type: Type.STRING,
                  description: "high | medium | low",
                },
                reason: { type: Type.STRING },
              },
              required: ["id", "category", "priority"],
            },
          },
          summary: { type: Type.STRING },
        },
        required: ["classifications", "summary"],
      },
    });

    const parsed = JSON.parse((response.text ?? "{}").trim());

    res.json({
      classifications: Array.isArray(parsed.classifications) ? parsed.classifications : [],
      summary: parsed.summary || "تم تصنيف المهام وتحديد أولوياتها بنجاح.",
    });
  } catch (error: any) {
    console.error("Error in /api/twin/classify-tasks:", error);
    res.status(500).json({ error: error.message || "فشل التصنيف التلقائي للمهام عبر Gemini" });
  }
});

// Unified Digital AI Assistant with Actionable Suggestions
app.post("/api/twin/assistant", async (req, res) => {
  try {
    const {
      message,
      history,
      profile,
      tasks,
      schedule,
      goals,
      quranRoutine,
      adhkarState,
      currentDate,
    } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "نص الرسالة مطلوب للتحدث مع المساعد الرقمي" });
    }

    const nowDate = currentDate ? new Date(currentDate) : new Date();
    const gregorianDateStr = nowDate.toLocaleDateString("ar-SA-u-ca-gregory", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const hijriDateStr = nowDate.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const compactTasks = (Array.isArray(tasks) ? tasks : []).slice(0, 20).map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      category: t.category,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
    }));

    const compactSchedule = (Array.isArray(schedule) ? schedule : []).slice(0, 15).map((b: any) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      category: b.category,
      isCompleted: b.isCompleted,
    }));

    const compactGoals = (Array.isArray(goals) ? goals : []).slice(0, 8).map((g: any) => ({
      title: g.title,
      progress: g.progress,
      targetDate: g.targetDate,
    }));

    const compactQuran = (Array.isArray(quranRoutine) ? quranRoutine : []).map((q: any) => ({
      title: q.title,
      targetAmount: q.targetAmount,
      completed: q.completed,
      timeSlot: q.timeSlot,
    }));

    const systemInstruction = `
أنت "المساعد الرقمي AI" والتوأم الذكي الشخصي للمستخدم (${profile?.name || "المستخدم"}).
تجمع بين دور المساعد التنفيذي، ومخطط اليوم، والموجّه الشخصي المتكامل مع المهام، التقويم الهجري والميلادي، الأهداف بعيدة المدى، وورد القرآن والأذكار.

بيانات اليوم والتاريخ:
- التاريخ الهجري: ${hijriDateStr}
- التاريخ الميلادي: ${gregorianDateStr}
- الوقت الحالي: ${nowDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}

ملف المستخدم:
- الاسم: ${profile?.name || "المستخدم"}
- الدور/المهنة: ${profile?.role || "محترف"}
- ساعات الذروة: ${profile?.peakEnergy || "صباحية"}
- أسلوب العمل: ${profile?.workStyle || "جلسات تركيز 45 دقيقة"}
- الأهداف الأساسية: ${profile?.mainGoals || "الإنتاجية والتوازن"}
- أسلوب الحديث المطلوب: ${profile?.tone || "عملي، ذكي، مشجع"}
- القواعد الذهبية: ${profile?.rules || ""}

المهام الحالية (${Array.isArray(tasks) ? tasks.length : 0}):
${JSON.stringify(compactTasks)}

جدول اليوم (${Array.isArray(schedule) ? schedule.length : 0}):
${JSON.stringify(compactSchedule)}

الأهداف بعيدة المدى (${Array.isArray(goals) ? goals.length : 0}):
${JSON.stringify(compactGoals)}

ورد القرآن اليومي:
${JSON.stringify(compactQuran)}

حالة الأذكار اليومية:
${JSON.stringify(adhkarState || {})}

تعليمات الإخراج الصارمة:
1. أجب باللغة العربية الواضحة والعملية، ورتب نصيحتك أو خطتك بنقاط مختصرة ومباشرة في حقل "reply".
2. إذا طلب المستخدم إضافة مهام أو اقترحت له خطة عمل، ضع المهام القابلة للإدراج مباشرة في "suggestedTasks" (وإلا أعد مصفوفة فارغة []).
3. إذا ذُكرت أوقات أو مواعيد أو اقترحت توزيعاً زمنياً، ضع الكتل الزمنية بصيغة 24 ساعة (HH:MM) في "suggestedEvents" (وإلا []).
4. إذا طلب أو احتاج هدفاً بعيد المدى، ضعه في "suggestedGoals" (وإلا []).
5. في "suggestedAction" حدد الإجراء الفوري الأنسب:
   - "start_focus" إذا كان الأنسب بدء جلسة تركيز الآن على مهمة محددة (مع وضع taskId الصحيح من قائمة المهام إن وجد).
   - "optimize_schedule" إذا طلب إعادة ترتيب الجدول بالذكاء الاصطناعي.
   - "open_schedule" إذا احتاج مراجعة الجدول اليومي.
   - "open_tasks" إذا احتاج مراجعة قائمة المهام.
   - "none" في المحادثات العامة.
`;

    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h?.content) {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: String(h.content) }],
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await generateContentSmart("/api/twin/assistant", {
      contents,
      systemInstruction,
      thinkingLevel: ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reply: {
            type: Type.STRING,
            description: "رد المساعد الرقمي الشامل والعملي باللغة العربية",
          },
          suggestedTasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                priority: { type: Type.STRING, description: "high | medium | low" },
                category: {
                  type: Type.STRING,
                  description: "work | personal | health | study | urgent",
                },
                estimatedMinutes: { type: Type.INTEGER },
                dueDate: { type: Type.STRING },
                dueTime: { type: Type.STRING },
              },
              required: ["title", "priority", "category"],
            },
          },
          suggestedEvents: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                startTime: { type: Type.STRING, description: "HH:MM 24h" },
                endTime: { type: Type.STRING, description: "HH:MM 24h" },
                category: {
                  type: Type.STRING,
                  description: "deep_work | meeting | routine | health | personal | review",
                },
              },
              required: ["title", "startTime", "endTime"],
            },
          },
          suggestedGoals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  description: "work | personal | learning | health",
                },
                targetDate: { type: Type.STRING },
                progress: { type: Type.INTEGER },
              },
              required: ["title", "category", "targetDate"],
            },
          },
          suggestedAction: {
            type: Type.OBJECT,
            properties: {
              type: {
                type: Type.STRING,
                description: "start_focus | optimize_schedule | open_schedule | open_tasks | none",
              },
              label: { type: Type.STRING },
              taskId: { type: Type.STRING },
            },
            required: ["type", "label"],
          },
        },
        required: ["reply", "suggestedTasks", "suggestedEvents", "suggestedGoals", "suggestedAction"],
      },
    });

    const parsed = JSON.parse((response.text ?? "{}").trim());

    res.json({
      reply:
        parsed.reply ||
        "أنا معك الآن؛ دعنا نرتب أهم مهامك ونبدأ بالخطوة الأعلى أثراً في يومك.",
      suggestedTasks: Array.isArray(parsed.suggestedTasks) ? parsed.suggestedTasks : [],
      suggestedEvents: Array.isArray(parsed.suggestedEvents) ? parsed.suggestedEvents : [],
      suggestedGoals: Array.isArray(parsed.suggestedGoals) ? parsed.suggestedGoals : [],
      suggestedAction: parsed.suggestedAction || { type: "none", label: "" },
    });
  } catch (error: any) {
    console.error("Error in /api/twin/assistant:", error);
    res.status(500).json({ error: error.message || "فشل الاتصال بالمساعد الرقمي AI" });
  }
});

// Ensure unknown /api/* requests return JSON instead of SPA HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});

// Vite middleware setup
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const hmrDisabled = process.env.DISABLE_HMR === "true";

    if (hmrDisabled) {
      app.get("/@vite/client", (_req, res) => {
        res.type("application/javascript").send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url) { return url; }
export class ErrorOverlay {}
`);
      });
    }

    const vite = await createViteServer({
      plugins: [
        {
          name: "express-hmr-server",
          config(userConfig) {
            if (hmrDisabled || userConfig.server?.hmr === false) {
              return { server: { hmr: false, ws: false } };
            }
            return {
              server: {
                hmr: {
                  server: httpServer,
                },
              },
            };
          },
          configResolved(resolvedConfig) {
            if (!hmrDisabled && resolvedConfig.server.hmr !== false) {
              (resolvedConfig.server as any).hmr = {
                ...(typeof resolvedConfig.server.hmr === "object"
                  ? resolvedConfig.server.hmr
                  : {}),
                server: httpServer,
              };
            }
          },
        },
      ],
      server: {
        middlewareMode: true,
        ws: hmrDisabled ? false : undefined,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Digital Twin Server running on http://localhost:${PORT}`);
  });
}

startServer();
