var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_http = __toESM(require("http"), 1);
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
var corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};
app.use((0, import_cors.default)(corsOptions));
app.options("*", (0, import_cors.default)(corsOptions));
app.use(import_express.default.json({ limit: "15mb" }));
function getAiClient() {
  const apiKey = (process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) {
    throw new Error("\u0645\u0641\u062A\u0627\u062D GEMINI_API_KEY \u063A\u064A\u0631 \u0645\u0647\u064A\u0623 \u0639\u0644\u0649 \u0627\u0644\u062E\u0627\u062F\u0645. \u064A\u0631\u062C\u0649 \u0625\u0636\u0627\u0641\u062A\u0647 \u0641\u064A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0633\u0631\u0627\u0631 (Settings > Secrets).");
  }
  return new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var primaryCooldownUntil = 0;
async function generateContentSmart(label, params, primaryTimeoutMs = 8e3, fallbackTimeoutMs = 25e3) {
  const ai = getAiClient();
  const buildConfig = (isPrimary, signal) => {
    const cfg = { abortSignal: signal };
    if (params.systemInstruction) cfg.systemInstruction = params.systemInstruction;
    if (params.responseMimeType) cfg.responseMimeType = params.responseMimeType;
    if (params.responseSchema) cfg.responseSchema = params.responseSchema;
    if (isPrimary && params.thinkingLevel) {
      cfg.thinkingConfig = { thinkingLevel: params.thinkingLevel };
    }
    return cfg;
  };
  if (Date.now() >= primaryCooldownUntil) {
    const primaryCtrl = new AbortController();
    const primaryTimer = setTimeout(() => primaryCtrl.abort(), primaryTimeoutMs);
    const t0 = Date.now();
    try {
      const res = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: params.contents,
        config: buildConfig(true, primaryCtrl.signal)
      });
      console.info(`[Gemini] ${label} (gemini-4-hydrogen) completed in ${Date.now() - t0}ms`);
      return res;
    } catch (primaryErr) {
      const primaryElapsed = Date.now() - t0;
      primaryCooldownUntil = Date.now() + 6e4;
      console.warn(
        `[Gemini] ${label} primary gemini-4-hydrogen failed after ${primaryElapsed}ms (${primaryErr?.status || primaryErr?.name || "err"}: ${primaryErr?.message || primaryErr}). Cooling down 60s and falling back to gemini-3.1-flash-lite...`
      );
    } finally {
      clearTimeout(primaryTimer);
    }
  } else {
    console.info(`[Gemini] ${label} using gemini-3.1-flash-lite during primary cooldown`);
  }
  const fallbackCtrl = new AbortController();
  const fallbackTimer = setTimeout(() => fallbackCtrl.abort(), fallbackTimeoutMs);
  const t1 = Date.now();
  try {
    const fallbackRes = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: params.contents,
      config: buildConfig(false, fallbackCtrl.signal)
    });
    console.info(`[Gemini] ${label} (gemini-3.1-flash-lite fallback) completed in ${Date.now() - t1}ms`);
    return fallbackRes;
  } catch (fallbackErr) {
    console.error(
      `[Gemini] ${label} fallback also failed after ${Date.now() - t1}ms:`,
      fallbackErr
    );
    throw fallbackErr;
  } finally {
    clearTimeout(fallbackTimer);
  }
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/twin/chat", async (req, res) => {
  try {
    const { message, history, profile, tasks, schedule, context } = req.body;
    const systemInstruction = `
\u0623\u0646\u062A "\u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0627\u0644\u0630\u0643\u064A\u0629" (Digital Twin / \u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0631\u0642\u0645\u064A) \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 ${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"}.
\u062F\u0648\u0631\u0643 \u0627\u0644\u0623\u0633\u0627\u0633\u064A \u0647\u0648 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0639\u0642\u0644\u0647 \u0627\u0644\u062B\u0627\u0646\u064A \u0648\u0645\u062F\u064A\u0631 \u0645\u0647\u0627\u0645\u0647 \u0648\u062C\u062F\u0648\u0644\u0647 \u0627\u0644\u064A\u0648\u0645\u064A\u060C \u062A\u0641\u0643\u0631 \u0628\u0646\u0641\u0633 \u0645\u0646\u0637\u0642\u0647 \u0648\u0623\u0647\u062F\u0627\u0641\u0647 \u0648\u062A\u062D\u0645\u064A\u0647 \u0645\u0646 \u0627\u0644\u062A\u0634\u062A\u062A \u0648\u0627\u0644\u062A\u0633\u0648\u064A\u0641 \u0648\u0627\u0644\u0625\u0631\u0647\u0627\u0642.

\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0645\u0644\u0641 \u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0631\u0642\u0645\u064A:
- \u0627\u0644\u0627\u0633\u0645: ${profile?.name || "\u0645\u0633\u062A\u062E\u062F\u0645"}
- \u0627\u0644\u0645\u0647\u0646\u0629/\u0627\u0644\u062F\u0648\u0631: ${profile?.role || "\u0645\u0633\u062A\u0642\u0644 / \u0645\u062D\u062A\u0631\u0641"}
- \u0633\u0627\u0639\u0627\u062A \u0630\u0631\u0648\u0629 \u0627\u0644\u0637\u0627\u0642\u0629: ${profile?.peakEnergy || "\u0635\u0628\u0627\u062D\u064A\u0629 (8:00 \u0635 - 1:00 \u0645)"}
- \u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u0639\u0645\u0644: ${profile?.workStyle || "\u062C\u0644\u0633\u0627\u062A \u062A\u0631\u0643\u064A\u0632 \u0639\u0645\u064A\u0642 50 \u062F\u0642\u064A\u0642\u0629"}
- \u0627\u0644\u0623\u0647\u062F\u0627\u0641 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629: ${profile?.mainGoals || "\u0625\u0646\u062C\u0627\u0632 \u0627\u0644\u0645\u0634\u0627\u0631\u064A\u0639 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u0627\u0644\u0645\u062D\u0627\u0641\u0638\u0629 \u0639\u0644\u0649 \u0627\u0644\u062A\u0648\u0627\u0632\u0646"}
- \u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0637\u0644\u0648\u0628: ${profile?.tone || "\u062D\u0627\u0632\u0645\u060C \u0630\u0643\u064A\u060C \u0645\u0634\u062C\u0639 \u0648\u0648\u0627\u0642\u0639\u064A"}
- \u0642\u0648\u0627\u0639\u062F\u0643 \u0627\u0644\u0630\u0647\u0628\u064A\u0629: ${profile?.rules || "\u0644\u0627 \u062A\u0624\u062C\u0644 \u0623\u0647\u0645 \u0645\u0647\u0645\u0629 \u0641\u064A \u0627\u0644\u064A\u0648\u0645\u060C \u062E\u0630 \u0641\u062A\u0631\u0627\u062A \u0631\u0627\u062D\u0629 \u062D\u0642\u064A\u0642\u064A\u0629"}

\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645:
${JSON.stringify(tasks || [], null, 2)}

\u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0632\u0645\u0646\u064A \u0644\u0644\u064A\u0648\u0645:
${JSON.stringify(schedule || [], null, 2)}

\u0633\u064A\u0627\u0642 \u0625\u0636\u0627\u0641\u064A: ${context || "\u0645\u062D\u0627\u062F\u062B\u0629 \u0639\u0627\u0645\u0629"}

\u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u0631\u062F:
1. \u062A\u062D\u062F\u062B \u062F\u0627\u0626\u0645\u0627\u064B \u0628\u0636\u0645\u064A\u0631 \u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0645\u062A\u0637\u0627\u0628\u0642/\u0627\u0644\u0645\u0633\u062A\u0634\u0627\u0631 \u0627\u0644\u062F\u0627\u062E\u0644\u064A \u0627\u0644\u0645\u0642\u0631\u0628 (\u0645\u062B\u0644\u0627\u064B: "\u0628\u0635\u0641\u062A\u064A \u0646\u0633\u062E\u062A\u0643 \u0627\u0644\u0631\u0642\u0645\u064A\u0629..."\u060C "\u0645\u0639\u0627\u064B \u0633\u0646\u0646\u0647\u064A \u0647\u0630\u0627..."\u060C "\u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0648\u062A\u064A\u0631\u0629 \u0637\u0627\u0642\u062A\u0646\u0627 \u0627\u0644\u064A\u0648\u0645...").
2. \u0627\u062C\u0639\u0644 \u0625\u062C\u0627\u0628\u0627\u062A\u0643 \u0639\u0645\u0644\u064A\u0629\u060C \u0648\u0627\u0636\u062D\u0629\u060C \u0645\u0631\u062A\u0628\u0629 \u0628\u0646\u0642\u0627\u0637\u060C \u0648\u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u062D\u0649 \u0627\u0644\u0633\u0644\u0633\u0629 \u0648\u0627\u0644\u0645\u0634\u062C\u0639\u0629.
3. \u0625\u0630\u0627 \u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0631\u0623\u064A\u0643 \u0641\u064A \u0645\u0627 \u064A\u0628\u062F\u0623 \u0628\u0647 \u0627\u0644\u0622\u0646\u060C \u0627\u0646\u0638\u0631 \u0644\u0645\u0647\u0627\u0645\u0647 \u0648\u062C\u062F\u0648\u0644\u0647 \u0648\u0623\u0639\u0637\u0647 \u062E\u0637\u0648\u0629 \u0641\u0648\u0631\u064A\u0629 \u0645\u062D\u062F\u062F\u0629.
4. \u0625\u0630\u0627 \u0643\u0627\u0646 \u0645\u062D\u0628\u0637\u0627\u064B \u0623\u0648 \u0645\u0634\u062A\u062A\u0627\u064B\u060C \u0643\u0646 \u062F\u0627\u0639\u0645\u0627\u064B \u0648\u0627\u0642\u062A\u0631\u062D \u062A\u0642\u0644\u064A\u0635 \u0627\u0644\u062D\u0645\u0644 \u0627\u0644\u0630\u0647\u0646\u064A.
5. \u064A\u0645\u0643\u0646\u0643 \u0627\u0642\u062A\u0631\u0627\u062D \u0625\u0636\u0627\u0641\u0629 \u0645\u0647\u0627\u0645 \u062C\u062F\u064A\u062F\u0629 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644 \u0623\u0648\u0642\u0627\u062A \u0625\u0630\u0627 \u062A\u0637\u0644\u0628 \u0627\u0644\u0623\u0645\u0631.
`;
    const contents = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.content }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });
    const response = await generateContentSmart("/api/twin/chat", {
      contents,
      systemInstruction,
      thinkingLevel: import_genai.ThinkingLevel.LOW
    });
    res.json({
      reply: response.text || "\u0623\u0646\u0627 \u0647\u0646\u0627 \u0645\u0639\u0643\u060C \u062F\u0639\u0646\u0627 \u0646\u0631\u0627\u062C\u0639 \u0645\u0647\u0627\u0645\u0643 \u0648\u0646\u0631\u062A\u0628 \u0623\u0648\u0644\u0648\u064A\u0627\u062A\u0646\u0627 \u0627\u0644\u064A\u0648\u0645."
    });
  } catch (error) {
    console.error("Error in /api/twin/chat:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0631\u0642\u0645\u064A" });
  }
});
app.post("/api/twin/optimize-schedule", async (req, res) => {
  try {
    const { tasks, fixedEvents, profile, date, targetWorkHours } = req.body;
    const prompt = `
\u0628\u0635\u0641\u062A\u0643 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0648\u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0630\u0643\u064A \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"})\u060C \u0642\u0645 \u0628\u0628\u0646\u0627\u0621 \u0648\u062A\u062D\u0633\u064A\u0646 \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0632\u0645\u0646\u064A \u0627\u0644\u064A\u0648\u0645\u064A \u0627\u0644\u0643\u0627\u0645\u0644 \u0644\u064A\u0648\u0645 (${date || "\u0627\u0644\u064A\u0648\u0645"}).

\u0645\u0639\u0644\u0648\u0645\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u062A\u0641\u0636\u064A\u0644\u0627\u062A\u0647:
- \u0630\u0631\u0648\u0629 \u0627\u0644\u0625\u0646\u062A\u0627\u062C\u064A\u0629 \u0648\u0627\u0644\u062A\u0631\u0643\u064A\u0632: ${profile?.peakEnergy || "\u0635\u0628\u0627\u062D\u064A"}
- \u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u0639\u0645\u0644: ${profile?.workStyle || "\u062A\u0631\u0643\u064A\u0632 45 \u062F\u0642\u064A\u0642\u0629 + \u0631\u0627\u062D\u0629 10 \u062F\u0642\u0627\u0626\u0642"}
- \u0633\u0627\u0639\u0627\u062A \u0627\u0644\u0639\u0645\u0644 \u0627\u0644\u0645\u0633\u062A\u0647\u062F\u0641\u0629: ${targetWorkHours || "6 \u0625\u0644\u0649 8 \u0633\u0627\u0639\u0627\u062A"}

\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u062F\u0631\u0627\u062C\u0647\u0627 \u0648\u062C\u062F\u0648\u0644\u062A\u0647\u0627:
${JSON.stringify(tasks || [], null, 2)}

\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0648\u0627\u0644\u0623\u062D\u062F\u0627\u062B \u0627\u0644\u062B\u0627\u0628\u062A\u0629 (\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u0648\u0642\u062A\u0647\u0627):
${JSON.stringify(fixedEvents || [], null, 2)}

\u0642\u0648\u0627\u0639\u062F \u0628\u0646\u0627\u0621 \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0645\u062B\u0627\u0644\u064A:
1. \u0636\u0639 \u0627\u0644\u0645\u0647\u0627\u0645 \u0630\u0627\u062A \u0627\u0644\u062A\u0631\u0643\u064A\u0632 \u0627\u0644\u0639\u0627\u0644\u064A (Deep Work) \u0641\u064A \u0633\u0627\u0639\u0627\u062A \u0630\u0631\u0648\u0629 \u0627\u0644\u0637\u0627\u0642\u0629.
2. \u0627\u062D\u062A\u0631\u0645 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u062B\u0627\u0628\u062A\u0629 \u0628\u0627\u0644\u062F\u0642\u064A\u0642\u0629.
3. \u0648\u0632\u0639 \u0641\u062A\u0631\u0627\u062A \u0631\u0627\u062D\u0629 \u062D\u0642\u064A\u0642\u064A\u0629 \u0648\u0648\u062C\u0628\u0627\u062A \u0637\u0639\u0627\u0645 \u0648\u062A\u062C\u062F\u064A\u062F \u0646\u0634\u0627\u0637 \u0644\u062A\u062C\u0646\u0628 \u0627\u0644\u0625\u0631\u0647\u0627\u0642.
4. \u062E\u0635\u0635 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u064A\u0648\u0645 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0633\u0631\u064A\u0639\u0629 \u0648\u0625\u063A\u0644\u0627\u0642 \u0627\u0644\u0645\u0647\u0627\u0645 \u0648\u0627\u0644\u062A\u062E\u0637\u064A\u0637 \u0644\u0644\u063A\u062F.
5. \u0623\u0631\u062C\u0639 \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0628\u062A\u0646\u0633\u064A\u0642 JSON \u0645\u0637\u0627\u0628\u0642 \u0644\u0644\u0645\u062E\u0637\u0637 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u060C \u0645\u0639 \u062A\u0642\u062F\u064A\u0645 \u0646\u0635\u0627\u0626\u062D \u0645\u0648\u062C\u0632\u0629 \u0648\u062E\u0637\u0629 \u0639\u0645\u0644 \u0630\u0643\u064A\u0629.
`;
    const response = await generateContentSmart(
      "/api/twin/optimize-schedule",
      {
        contents: prompt,
        thinkingLevel: import_genai.ThinkingLevel.MEDIUM,
        responseMimeType: "application/json",
        responseSchema: {
          type: import_genai.Type.OBJECT,
          properties: {
            summary: {
              type: import_genai.Type.STRING,
              description: "\u0645\u0644\u062E\u0635 \u062A\u062D\u0644\u064A\u0644\u064A \u0644\u062E\u0637\u0629 \u0627\u0644\u064A\u0648\u0645 \u0648\u0646\u0638\u0631\u0629 \u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0631\u0642\u0645\u064A"
            },
            energyStrategy: {
              type: import_genai.Type.STRING,
              description: "\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0637\u0627\u0642\u0629 \u0644\u0644\u064A\u0648\u0645"
            },
            timeBlocks: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  id: { type: import_genai.Type.STRING },
                  startTime: { type: import_genai.Type.STRING, description: "\u0635\u064A\u063A\u0629 24 \u0633\u0627\u0639\u0629 \u0645\u062B\u0644 08:30" },
                  endTime: { type: import_genai.Type.STRING, description: "\u0635\u064A\u063A\u0629 24 \u0633\u0627\u0639\u0629 \u0645\u062B\u0644 09:30" },
                  title: { type: import_genai.Type.STRING },
                  description: { type: import_genai.Type.STRING },
                  category: {
                    type: import_genai.Type.STRING,
                    description: "deep_work | meeting | routine | health | personal | review"
                  },
                  relatedTaskId: { type: import_genai.Type.STRING, description: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0647\u0645\u0629 \u0625\u0630\u0627 \u0643\u0627\u0646\u062A \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0645\u0647\u0645\u0629" },
                  priority: { type: import_genai.Type.STRING, description: "high | medium | low" },
                  energyLevel: { type: import_genai.Type.STRING, description: "high | medium | low" },
                  iconName: { type: import_genai.Type.STRING }
                },
                required: ["id", "startTime", "endTime", "title", "category", "priority"]
              }
            },
            topPriorities: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "\u0623\u0647\u0645 3 \u0623\u0648\u0644\u0648\u064A\u0627\u062A \u0644\u0627 \u062A\u0642\u0628\u0644 \u0627\u0644\u062A\u0623\u062C\u064A\u0644 \u0644\u0644\u064A\u0648\u0645"
            },
            warnings: {
              type: import_genai.Type.ARRAY,
              items: { type: import_genai.Type.STRING },
              description: "\u062A\u0646\u0628\u064A\u0647\u0627\u062A \u062D\u0648\u0644 \u0623\u064A \u0636\u063A\u0637 \u0645\u062D\u062A\u0645\u0644 \u0623\u0648 \u062A\u0636\u0627\u0631\u0628 \u0641\u064A \u0627\u0644\u0648\u0642\u062A"
            }
          },
          required: ["summary", "timeBlocks", "topPriorities"]
        }
      },
      15e3
    );
    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Error in /api/twin/optimize-schedule:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u062A\u062D\u0633\u064A\u0646 \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0632\u0645\u0646\u064A" });
  }
});
app.post("/api/twin/breakdown-task", async (req, res) => {
  try {
    const { taskTitle, taskDescription, estimatedHours, profile } = req.body;
    const prompt = `
\u0628\u0635\u0641\u062A\u0643 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0644\u0640 (${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"})\u060C \u0641\u0643\u0643 \u0647\u0630\u0647 \u0627\u0644\u0645\u0647\u0645\u0629 \u0627\u0644\u0643\u0628\u064A\u0631\u0629 \u0623\u0648 \u0627\u0644\u0645\u0639\u0642\u062F\u0629 \u0625\u0644\u0649 \u062E\u0637\u0648\u0627\u062A \u062A\u0646\u0641\u064A\u0630\u064A\u0629 \u0648\u0627\u0636\u062D\u0629 \u0648\u0635\u063A\u064A\u0631\u0629 \u062A\u0642\u0644\u0644 \u0627\u0644\u0645\u0642\u0627\u0648\u0645\u0629 \u0627\u0644\u0646\u0641\u0633\u064A\u0629 \u0648\u0627\u0644\u062A\u0633\u0648\u064A\u0641:

\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0647\u0645\u0629: ${taskTitle}
\u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644: ${taskDescription || "\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0641\u0627\u0635\u064A\u0644 \u0625\u0636\u0627\u0641\u064A\u0629"}
\u0627\u0644\u0648\u0642\u062A \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A \u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A: ${estimatedHours || "\u0633\u0627\u0639\u062A\u0627\u0646"}

\u0627\u0644\u0645\u0637\u0644\u0648\u0628:
1. \u062A\u0642\u0633\u064A\u0645 \u0627\u0644\u0645\u0647\u0645\u0629 \u0625\u0644\u0649 3 - 6 \u062E\u0637\u0648\u0627\u062A \u062F\u0642\u064A\u0642\u0629 \u0648\u0648\u0627\u0636\u062D\u0629.
2. \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0645\u062A\u0648\u0642\u0639 \u0644\u0643\u0644 \u062E\u0637\u0648\u0629 \u0628\u0627\u0644\u062F\u0642\u0627\u0626\u0642 (\u0645\u062B\u0627\u0644: 15\u060C 25\u060C 40 \u062F\u0642\u064A\u0642\u0629).
3. \u062A\u0642\u062F\u064A\u0645 \u0646\u0635\u064A\u062D\u0629 \u0630\u0643\u064A\u0629 \u0644\u0644\u0628\u062F\u0621 \u0628\u0623\u0633\u0647\u0644 \u062E\u0637\u0648\u0629 \u0644\u0643\u0633\u0631 \u0627\u0644\u062C\u0645\u0648\u062F.
`;
    const response = await generateContentSmart("/api/twin/breakdown-task", {
      contents: prompt,
      thinkingLevel: import_genai.ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          breakdownOverview: { type: import_genai.Type.STRING },
          quickWinTip: { type: import_genai.Type.STRING, description: "\u0623\u0633\u0631\u0639 \u062D\u0631\u0643\u0629 \u0644\u0643\u0633\u0631 \u0627\u0644\u062A\u0633\u0648\u064A\u0641 \u0648\u0627\u0644\u0628\u062F\u0621 \u0641\u0648\u0631\u0627\u064B" },
          subtasks: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                estimatedMinutes: { type: import_genai.Type.INTEGER },
                difficulty: { type: import_genai.Type.STRING, description: "easy | medium | hard" },
                focusTip: { type: import_genai.Type.STRING }
              },
              required: ["title", "estimatedMinutes", "difficulty"]
            }
          }
        },
        required: ["breakdownOverview", "subtasks", "quickWinTip"]
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Error in /api/twin/breakdown-task:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u062A\u0641\u0643\u064A\u0643 \u0627\u0644\u0645\u0647\u0645\u0629" });
  }
});
app.post("/api/twin/parse-quick-entry", async (req, res) => {
  try {
    const { naturalText, currentDate } = req.body;
    const refDate = currentDate ? new Date(currentDate) : /* @__PURE__ */ new Date();
    const todayIso = refDate.toISOString().split("T")[0];
    const prompt = `
\u0642\u0645 \u0628\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0646\u0635 \u0623\u0648 \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u0635\u0648\u062A\u064A \u0627\u0644\u0645\u062F\u062E\u0644 \u0627\u0644\u062A\u0627\u0644\u064A \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0627\u0633\u062A\u062E\u0631\u062C \u0645\u0646\u0647 \u0627\u0644\u0645\u0647\u0627\u0645 \u0648\u062C\u062F\u0648\u0644 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0628\u062F\u0642\u0629:
\u0627\u0644\u0646\u0635: "${naturalText}"
\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0645\u064A\u0644\u0627\u062F\u064A: "${todayIso}" (\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0648\u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0643\u0627\u0645\u0644: "${refDate.toISOString()}")

\u0627\u0633\u062A\u062E\u0631\u062C:
1. \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0646\u062C\u0627\u0632\u0647\u0627 (extractedTasks): \u0645\u0639 \u0627\u0644\u0639\u0646\u0648\u0627\u0646\u060C \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629 (high, medium, low)\u060C \u0627\u0644\u062A\u0635\u0646\u064A\u0641 (work, personal, health, study, urgent)\u060C \u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A\u0629 \u0628\u0627\u0644\u062F\u0642\u0627\u0626\u0642\u060C \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 (YYYY-MM-DD)\u060C \u0648\u0648\u0642\u062A \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0625\u0646 \u0630\u064F\u0643\u0631 (HH:MM \u0628\u0635\u064A\u063A\u0629 24 \u0633\u0627\u0639\u0629).
2. \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0623\u0648 \u0627\u0644\u0623\u062D\u062F\u0627\u062B \u0627\u0644\u0645\u062D\u062F\u062F\u0629 \u0628\u0648\u0642\u062A (extractedEvents): \u0648\u0642\u062A \u0627\u0644\u0628\u062F\u0627\u064A\u0629 \u0648\u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u0628\u0635\u064A\u063A\u0629 24 \u0633\u0627\u0639\u0629 (HH:MM - \u0625\u0630\u0627 \u0644\u0645 \u064A\u064F\u0630\u0643\u0631 \u0648\u0642\u062A \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u0642\u062F\u0651\u0631\u0647 \u0628\u0625\u0636\u0627\u0641\u0629 45 \u0623\u0648 60 \u062F\u0642\u064A\u0642\u0629 \u0644\u0648\u0642\u062A \u0627\u0644\u0628\u062F\u0627\u064A\u0629)\u060C \u0627\u0644\u0639\u0646\u0648\u0627\u0646\u060C \u0648\u0627\u0644\u062A\u0635\u0646\u064A\u0641 (deep_work, meeting, routine, health, personal, review).
`;
    const response = await generateContentSmart("/api/twin/parse-quick-entry", {
      contents: prompt,
      thinkingLevel: import_genai.ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          extractedTasks: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                description: { type: import_genai.Type.STRING },
                priority: { type: import_genai.Type.STRING, description: "high | medium | low" },
                category: { type: import_genai.Type.STRING, description: "work | personal | health | study | urgent" },
                estimatedMinutes: { type: import_genai.Type.INTEGER },
                dueDate: { type: import_genai.Type.STRING },
                dueTime: { type: import_genai.Type.STRING, description: "HH:MM 24h" }
              },
              required: ["title", "priority", "category"]
            }
          },
          extractedEvents: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                startTime: { type: import_genai.Type.STRING, description: "\u0635\u064A\u063A\u0629 24 \u0633\u0627\u0639\u0629 \u0645\u062B\u0644 10:00" },
                endTime: { type: import_genai.Type.STRING, description: "\u0635\u064A\u063A\u0629 24 \u0633\u0627\u0639\u0629 \u0645\u062B\u0644 11:30" },
                category: { type: import_genai.Type.STRING }
              },
              required: ["title", "startTime", "endTime"]
            }
          },
          twinComment: { type: import_genai.Type.STRING, description: "\u062A\u0639\u0644\u064A\u0642 \u0633\u0631\u064A\u0639 \u0648\u0645\u062E\u062A\u0635\u0631 \u0645\u0646 \u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0631\u0642\u0645\u064A \u0639\u0644\u0649 \u0645\u0627 \u062A\u0645 \u0625\u062F\u0631\u0627\u062C\u0647" }
        },
        required: ["extractedTasks", "extractedEvents", "twinComment"]
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Error in /api/twin/parse-quick-entry:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0645\u0647\u0627\u0645" });
  }
});
app.post("/api/twin/briefing", async (req, res) => {
  try {
    const { type, profile, tasks, completedTasks, schedule } = req.body;
    const prompt = `
\u0623\u0646\u062A \u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0631\u0642\u0645\u064A \u0644\u0640 (${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"}).
\u0627\u0644\u0645\u0637\u0644\u0648\u0628: \u062A\u0648\u0644\u064A\u062F ${type === "evening" ? "\u062C\u0644\u0633\u0629 \u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0633\u0627\u0626\u064A\u0629 \u0648\u062A\u0644\u062E\u064A\u0635 \u0627\u0644\u0625\u0646\u062C\u0627\u0632\u0627\u062A" : "\u0645\u0648\u062C\u0632 \u0635\u0628\u0627\u062D\u064A \u0645\u062D\u0641\u0632 \u0648\u0630\u0643\u064A \u0644\u0628\u062F\u0621 \u0627\u0644\u064A\u0648\u0645 \u0628\u0642\u0648\u0629"}.

\u062D\u0627\u0644\u0629 \u0627\u0644\u064A\u0648\u0645:
- \u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0647\u0627\u0645: ${tasks?.length || 0}
- \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u0643\u062A\u0645\u0644\u0629: ${completedTasks?.length || 0}
- \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0647\u0627\u0645: ${JSON.stringify(tasks || [], null, 2)}
- \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u0632\u0645\u0646\u064A: ${JSON.stringify(schedule || [], null, 2)}
- \u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u062A\u0648\u0623\u0645: ${profile?.tone || "\u0645\u0634\u062C\u0639\u060C \u0648\u0627\u0642\u0639\u064A\u060C \u062D\u0627\u0632\u0645 \u0648\u0630\u0643\u064A"}

\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u062E\u0631\u0627\u062C\u0647 \u0628\u062A\u0646\u0633\u064A\u0642 JSON:
- headline: \u0639\u0628\u0627\u0631\u0629 \u0627\u0641\u062A\u062A\u0627\u062D\u064A\u0629 \u0642\u0648\u064A\u0629 \u0648\u0645\u062D\u0641\u0632\u0629 \u062E\u0627\u0635\u0629 \u0628\u0640 ${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"}
- mainAdvice: \u0646\u0635\u064A\u062D\u0629 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u0630\u0647\u0628\u064A\u0629 \u062A\u0631\u0643\u0632 \u0639\u0644\u0649 \u0627\u0644\u0637\u0627\u0642\u0629 \u0648\u0627\u0644\u0625\u0646\u062A\u0627\u062C\u064A\u0629
- topPriorities: \u0623\u0647\u0645 \u0623\u0648\u0644\u0648\u064A\u0627\u062A \u0623\u0648 \u0625\u0646\u062C\u0627\u0632\u0627\u062A
- energyQuote: \u062D\u0643\u0645\u0629 \u0623\u0648 \u062A\u0634\u062C\u064A\u0639 \u0642\u0635\u064A\u0631 \u0628\u0637\u0627\u0628\u0639 \u0634\u062E\u0635\u064A
`;
    const response = await generateContentSmart("/api/twin/briefing", {
      contents: prompt,
      thinkingLevel: import_genai.ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          headline: { type: import_genai.Type.STRING },
          mainAdvice: { type: import_genai.Type.STRING },
          topPriorities: {
            type: import_genai.Type.ARRAY,
            items: { type: import_genai.Type.STRING }
          },
          energyQuote: { type: import_genai.Type.STRING },
          syncScore: { type: import_genai.Type.INTEGER, description: "\u0646\u0633\u0628\u0629 \u0627\u0644\u062A\u0648\u0627\u0641\u0642 \u0648\u0627\u0644\u0625\u0646\u062C\u0627\u0632 0 - 100" }
        },
        required: ["headline", "mainAdvice", "topPriorities", "energyQuote"]
      }
    });
    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Error in /api/twin/briefing:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u062A\u0642\u0631\u064A\u0631" });
  }
});
app.post("/api/twin/voice-note", async (req, res) => {
  try {
    const { audioBase64, mimeType, profile, tasks, schedule, currentDate } = req.body;
    if (!audioBase64 || typeof audioBase64 !== "string") {
      return res.status(400).json({ error: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0628\u064A\u0627\u0646\u0627\u062A \u0635\u0648\u062A\u064A\u0629 \u0635\u0627\u0644\u062D\u0629" });
    }
    const cleanMimeType = typeof mimeType === "string" && mimeType.split(";")[0].trim() || "audio/webm";
    const audioPart = {
      inlineData: {
        mimeType: cleanMimeType,
        data: audioBase64
      }
    };
    const ai = getAiClient();
    const transcribeCtrl = new AbortController();
    const transcribeTimer = setTimeout(() => transcribeCtrl.abort(), 25e3);
    let transcriptionResponse;
    try {
      transcriptionResponse = await ai.models.generateContent({
        model: "gemini-3.5-transcribe",
        contents: {
          parts: [
            audioPart,
            {
              text: "\u0642\u0645 \u0628\u062A\u0641\u0631\u064A\u063A \u0647\u0630\u0627 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0635\u0648\u062A\u064A \u0628\u062F\u0642\u0629 \u0625\u0644\u0649 \u0646\u0635 \u0639\u0631\u0628\u064A \u0648\u0627\u0636\u062D (\u0623\u0648 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0645\u0646\u0637\u0648\u0642\u0629 \u0641\u064A\u0647) \u0645\u0639 \u0627\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u062C\u0645\u064A\u0639 \u0627\u0644\u062A\u0641\u0627\u0635\u064A\u0644 \u0648\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0648\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u0630\u0643\u0648\u0631\u0629 \u062F\u0648\u0646 \u0627\u062E\u062A\u0635\u0627\u0631."
            }
          ]
        },
        config: { abortSignal: transcribeCtrl.signal }
      });
    } finally {
      clearTimeout(transcribeTimer);
    }
    const transcript = (transcriptionResponse.text ?? "").trim();
    if (!transcript) {
      return res.status(422).json({
        error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u0639\u0631\u0641 \u0639\u0644\u0649 \u0643\u0644\u0627\u0645 \u0648\u0627\u0636\u062D \u0641\u064A \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0635\u0648\u062A\u064A\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
      });
    }
    const analysisPrompt = `
\u0623\u0646\u062A "\u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0627\u0644\u0630\u0643\u064A\u0629" \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"}).
\u0633\u062C\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u0635\u0648\u062A\u064A\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629\u060C \u0648\u062A\u0645 \u062A\u0641\u0631\u064A\u063A\u0647\u0627 \u0625\u0644\u0649 \u0627\u0644\u0646\u0635 \u0627\u0644\u0622\u062A\u064A:
"${transcript}"

\u062A\u0627\u0631\u064A\u062E \u0648\u0648\u0642\u062A \u0627\u0644\u0622\u0646: "${currentDate || (/* @__PURE__ */ new Date()).toISOString()}"
\u0633\u064A\u0627\u0642 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 (\u0639\u062F\u062F\u0647\u0627 ${Array.isArray(tasks) ? tasks.length : 0}) \u0648\u0627\u0644\u062C\u062F\u0648\u0644 (\u0639\u062F\u062F \u0643\u062A\u0644\u0647 ${Array.isArray(schedule) ? schedule.length : 0}).

\u0627\u0644\u0645\u0637\u0644\u0648\u0628:
1. \u0643\u062A\u0627\u0628\u0629 \u0645\u0644\u062E\u0635 \u0642\u0635\u064A\u0631 \u0648\u0648\u0627\u0636\u062D \u0644\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u0635\u0648\u062A\u064A\u0629 (summary).
2. \u0643\u062A\u0627\u0628\u0629 \u0631\u062F \u0645\u062E\u062A\u0635\u0631 \u0648\u0645\u0628\u0627\u0634\u0631 \u0645\u0646 \u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0631\u0642\u0645\u064A \u064A\u0648\u062C\u0647 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0645\u0627 \u062A\u0645 \u0627\u0633\u062A\u062E\u0631\u0627\u062C\u0647 \u0648\u0623\u0648\u0644 \u062E\u0637\u0648\u0629 \u0645\u0642\u062A\u0631\u062D\u0629 (twinReply).
3. \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0623\u064A \u0645\u0647\u0627\u0645 (extractedTasks) \u0630\u064F\u0643\u0631\u062A \u0641\u064A \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0635\u0648\u062A\u064A \u0645\u0639 \u0627\u0644\u0639\u0646\u0648\u0627\u0646\u060C \u0627\u0644\u0648\u0635\u0641 \u0627\u0644\u0645\u062E\u062A\u0635\u0631\u060C \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629 (high | medium | low)\u060C \u0627\u0644\u062A\u0635\u0646\u064A\u0641 (work | personal | health | study | urgent)\u060C \u0627\u0644\u0645\u062F\u0629 \u0627\u0644\u062A\u0642\u062F\u064A\u0631\u064A\u0629 \u0628\u0627\u0644\u062F\u0642\u0627\u0626\u0642\u060C \u0648\u062A\u0627\u0631\u064A\u062E/\u0648\u0642\u062A \u0627\u0644\u0627\u0633\u062A\u062D\u0642\u0627\u0642 \u0625\u0646 \u0630\u064F\u0643\u0631 (YYYY-MM-DD \u0648 HH:MM).
4. \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0623\u064A \u0645\u0648\u0627\u0639\u064A\u062F \u0623\u0648 \u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0645\u062D\u062F\u062F\u0629 \u0628\u0648\u0642\u062A (extractedEvents) \u0645\u0639 \u0648\u0642\u062A \u0627\u0644\u0628\u062F\u0627\u064A\u0629 \u0648\u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u0628\u0635\u064A\u063A\u0629 24 \u0633\u0627\u0639\u0629 (HH:MM).
`;
    const analysisResponse = await generateContentSmart("/api/twin/voice-note:analyze", {
      contents: analysisPrompt,
      thinkingLevel: import_genai.ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          summary: {
            type: import_genai.Type.STRING,
            description: "\u0645\u0644\u062E\u0635 \u0645\u0631\u0643\u0632 \u0648\u0645\u0641\u064A\u062F \u0644\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u0635\u0648\u062A\u064A\u0629 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629"
          },
          twinReply: {
            type: import_genai.Type.STRING,
            description: "\u0631\u062F \u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0631\u0642\u0645\u064A \u0639\u0644\u0649 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0646\u0628\u0631\u0629 \u0634\u062E\u0635\u064A\u0629 \u062F\u0627\u0639\u0645\u0629 \u0648\u0639\u0645\u0644\u064A\u0629"
          },
          extractedTasks: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                description: { type: import_genai.Type.STRING },
                priority: { type: import_genai.Type.STRING, description: "high | medium | low" },
                category: { type: import_genai.Type.STRING, description: "work | personal | health | study | urgent" },
                estimatedMinutes: { type: import_genai.Type.INTEGER },
                dueDate: { type: import_genai.Type.STRING },
                dueTime: { type: import_genai.Type.STRING }
              },
              required: ["title", "priority", "category"]
            }
          },
          extractedEvents: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                startTime: { type: import_genai.Type.STRING },
                endTime: { type: import_genai.Type.STRING },
                category: { type: import_genai.Type.STRING }
              },
              required: ["title", "startTime", "endTime"]
            }
          }
        },
        required: ["summary", "twinReply", "extractedTasks", "extractedEvents"]
      }
    });
    const parsed = JSON.parse((analysisResponse.text ?? "{}").trim());
    res.json({
      transcript,
      summary: parsed.summary || transcript,
      twinReply: parsed.twinReply || "\u062A\u0645 \u062A\u062D\u0644\u064A\u0644 \u0645\u0644\u0627\u062D\u0638\u062A\u0643 \u0627\u0644\u0635\u0648\u062A\u064A\u0629 \u0648\u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u0646\u0642\u0627\u0637 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629 \u0628\u0646\u062C\u0627\u062D.",
      extractedTasks: Array.isArray(parsed.extractedTasks) ? parsed.extractedTasks : [],
      extractedEvents: Array.isArray(parsed.extractedEvents) ? parsed.extractedEvents : []
    });
  } catch (error) {
    console.error("Error in /api/twin/voice-note:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u0645\u0639\u0627\u0644\u062C\u0629 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u0635\u0648\u062A\u064A\u0629" });
  }
});
app.post("/api/twin/contextual-briefing", async (req, res) => {
  try {
    const { task, profile, schedule, goals } = req.body;
    if (!task || !task.id) {
      return res.status(400).json({ error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0647\u0645\u0629 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0648\u062C\u0632 \u0627\u0644\u0633\u064A\u0627\u0642\u064A" });
    }
    const prompt = `
\u0628\u0635\u0641\u062A\u0643 "\u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0631\u0642\u0645\u064A\u0629 \u0627\u0644\u0630\u0643\u064A\u0629" \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"})\u060C \u062C\u0647\u0651\u0632 \u0645\u0648\u062C\u0632\u0627\u064B \u0633\u064A\u0627\u0642\u064A\u0627\u064B \u0641\u0648\u0631\u064A\u0627\u064B (Contextual Briefing) \u0642\u0628\u0644 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0645\u0647\u0645\u0629 \u0627\u0644\u062A\u0627\u0644\u064A\u0629:

\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0647\u0645\u0629:
${JSON.stringify(task, null, 2)}

\u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0642\u0648\u0627\u0639\u062F\u0647:
- \u0630\u0631\u0648\u0629 \u0627\u0644\u0637\u0627\u0642\u0629: ${profile?.peakEnergy || "\u0635\u0628\u0627\u062D\u064A"}
- \u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u0639\u0645\u0644: ${profile?.workStyle || "\u062C\u0644\u0633\u0627\u062A \u062A\u0631\u0643\u064A\u0632 45 \u062F\u0642\u064A\u0642\u0629"}
- \u0627\u0644\u0642\u0648\u0627\u0639\u062F: ${profile?.rules || ""}

\u0627\u0644\u0623\u0647\u062F\u0627\u0641 \u0628\u0639\u064A\u062F\u0629 \u0627\u0644\u0645\u062F\u0649 \u0627\u0644\u0645\u0631\u062A\u0628\u0637\u0629:
${JSON.stringify(goals || [], null, 2)}

\u0627\u0644\u0643\u062A\u0644 \u0627\u0644\u0632\u0645\u0646\u064A\u0629 \u0627\u0644\u0645\u062D\u064A\u0637\u0629 \u0641\u064A \u062C\u062F\u0648\u0644 \u0627\u0644\u064A\u0648\u0645:
${JSON.stringify(schedule || [], null, 2)}

\u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u062E\u0631\u0627\u062C\u0647 \u0628\u062A\u0646\u0633\u064A\u0642 JSON:
- summary: \u0645\u0644\u062E\u0635 \u0633\u064A\u0627\u0642\u064A \u0645\u0643\u062B\u0641 \u064A\u0648\u0636\u062D \u0623\u0647\u0645\u064A\u0629 \u0647\u0630\u0647 \u0627\u0644\u0645\u0647\u0645\u0629\u060C \u0643\u064A\u0641 \u062A\u0631\u062A\u0628\u0637 \u0628\u0623\u0647\u062F\u0627\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u062C\u062F\u0648\u0644\u0647 \u0627\u0644\u064A\u0648\u0645\u064A\u060C \u0648\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0630\u0647\u0646\u064A \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0644\u0625\u0646\u062C\u0627\u0632\u0647\u0627.
- keyNotes: \u0645\u0635\u0641\u0648\u0641\u0629 \u0645\u0646 3 \u0625\u0644\u0649 4 \u0646\u0642\u0627\u0637 \u0645\u0631\u062C\u0639\u064A\u0629 \u0639\u0645\u0644\u064A\u0629 (\u0646\u0642\u0627\u0637 \u062A\u0631\u0643\u064A\u0632\u060C \u0645\u062E\u0627\u0637\u0631 \u064A\u062C\u0628 \u062A\u062C\u0646\u0628\u0647\u0627\u060C \u0623\u0648 \u062A\u0641\u0627\u0635\u064A\u0644 \u0645\u0647\u0645\u0629 \u0645\u0646 \u0627\u0644\u0645\u0647\u0645\u0629 \u0646\u0641\u0633\u0647\u0627).
- suggestedAction: \u0625\u062C\u0631\u0627\u0621 \u0639\u0645\u0644\u064A \u0641\u0648\u0631\u064A \u0648\u0645\u062D\u062F\u062F \u064A\u0628\u062F\u0623 \u0628\u0647 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0641\u064A \u0623\u0648\u0644 \u062F\u0642\u064A\u0642\u062A\u064A\u0646 \u0644\u0643\u0633\u0631 \u0627\u0644\u062C\u0645\u0648\u062F.
`;
    const response = await generateContentSmart("/api/twin/contextual-briefing", {
      contents: prompt,
      thinkingLevel: import_genai.ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          summary: { type: import_genai.Type.STRING },
          keyNotes: {
            type: import_genai.Type.ARRAY,
            items: { type: import_genai.Type.STRING }
          },
          suggestedAction: { type: import_genai.Type.STRING }
        },
        required: ["summary", "keyNotes", "suggestedAction"]
      }
    });
    const parsed = JSON.parse((response.text ?? "{}").trim());
    res.json({
      taskId: task.id,
      summary: parsed.summary || "\u0647\u0630\u0647 \u0627\u0644\u0645\u0647\u0645\u0629 \u062C\u0632\u0621 \u0623\u0633\u0627\u0633\u064A \u0645\u0646 \u062A\u0642\u062F\u0645\u0643 \u0627\u0644\u064A\u0648\u0645 \u0646\u062D\u0648 \u0623\u0647\u062F\u0627\u0641\u0643.",
      keyNotes: Array.isArray(parsed.keyNotes) ? parsed.keyNotes : [],
      suggestedAction: parsed.suggestedAction || "\u0627\u0628\u062F\u0623 \u0628\u062A\u062E\u0635\u064A\u0635 25 \u062F\u0642\u064A\u0642\u0629 \u062A\u0631\u0643\u064A\u0632 \u0643\u0627\u0645\u0644\u0629 \u0644\u0644\u062E\u0637\u0648\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u062F\u0648\u0646 \u0645\u0634\u062A\u062A\u0627\u062A."
    });
  } catch (error) {
    console.error("Error in /api/twin/contextual-briefing:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u062A\u0648\u0644\u064A\u062F \u0627\u0644\u0645\u0648\u062C\u0632 \u0627\u0644\u0633\u064A\u0627\u0642\u064A \u0644\u0644\u0645\u0647\u0645\u0629" });
  }
});
app.post("/api/twin/classify-tasks", async (req, res) => {
  try {
    const { tasks, profile } = req.body;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0645\u0647\u0627\u0645 \u0644\u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0644\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A" });
    }
    const compactTasks = tasks.slice(0, 40).map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      estimatedMinutes: t.estimatedMinutes || 30,
      dueDate: t.dueDate || "",
      dueTime: t.dueTime || ""
    }));
    const prompt = `
\u0628\u0635\u0641\u062A\u0643 \u0645\u0633\u0627\u0639\u062F \u062A\u0646\u0638\u064A\u0645 \u0630\u0643\u064A \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"} - ${profile?.role || "\u0645\u062D\u062A\u0631\u0641"})\u060C \u0642\u0645 \u0628\u062A\u062D\u0644\u064A\u0644 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062A\u0627\u0644\u064A\u0629 \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0648\u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629 \u0627\u0644\u0623\u0646\u0633\u0628 \u0644\u0643\u0644 \u0645\u0647\u0645\u0629 \u0628\u062F\u0642\u0629.

\u0623\u0647\u062F\u0627\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629: ${profile?.mainGoals || "\u0627\u0644\u0625\u0646\u062A\u0627\u062C\u064A\u0629 \u0648\u0627\u0644\u062A\u0648\u0627\u0632\u0646"}

\u0627\u0644\u062A\u0635\u0646\u064A\u0641\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629 \u0641\u0642\u0637 (category):
- "work": \u0623\u0639\u0645\u0627\u0644 \u0648\u0645\u0634\u0627\u0631\u064A\u0639 \u0648\u0627\u062C\u062A\u0645\u0627\u0639\u0627\u062A \u0648\u062A\u0642\u0627\u0631\u064A\u0631 \u0645\u0647\u0646\u064A\u0629
- "personal": \u0634\u0624\u0648\u0646 \u0634\u062E\u0635\u064A\u0629 \u0648\u0639\u0627\u0626\u0644\u064A\u0629 \u0648\u0645\u0646\u0632\u0644\u064A\u0629 \u0648\u062A\u0633\u0648\u0642 \u0648\u0639\u0628\u0627\u062F\u0627\u062A
- "health": \u0631\u064A\u0627\u0636\u0629 \u0648\u0635\u062D\u0629 \u0648\u062A\u063A\u0630\u064A\u0629 \u0648\u0631\u0627\u062D\u0629 \u0648\u0646\u0648\u0645 \u0648\u0645\u0648\u0627\u0639\u064A\u062F \u0637\u0628\u064A\u0629
- "study": \u062A\u0639\u0644\u0645 \u0648\u0642\u0631\u0627\u0621\u0629 \u0648\u062F\u0648\u0631\u0627\u062A \u0648\u0645\u0647\u0627\u0631\u0627\u062A \u0648\u0645\u0630\u0627\u0643\u0631\u0629
- "urgent": \u0623\u0645\u0648\u0631 \u0637\u0627\u0631\u0626\u0629 \u062C\u062F\u0627\u064B \u0623\u0648 \u0627\u0644\u062A\u0632\u0627\u0645\u0627\u062A \u062D\u0631\u062C\u0629 \u0641\u0648\u0631\u064A\u0629

\u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D\u0629 \u0641\u0642\u0637 (priority):
- "high": \u0639\u0627\u062C\u0644 \u0648\u0647\u0627\u0645 \u0623\u0648 \u0630\u0648 \u0623\u062B\u0631 \u0643\u0628\u064A\u0631 \u0623\u0648 \u0645\u0648\u0639\u062F \u0642\u0631\u064A\u0628 \u062D\u0631\u062C
- "medium": \u0645\u0647\u0645 \u0628\u062F\u0631\u062C\u0629 \u0645\u062A\u0648\u0633\u0637\u0629 \u0623\u0648 \u0639\u0645\u0644 \u0627\u0639\u062A\u064A\u0627\u062F\u064A
- "low": \u0645\u0647\u0645\u0629 \u062E\u0641\u064A\u0641\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0645\u0633\u062A\u0639\u062C\u0644\u0629 \u0648\u064A\u0645\u0643\u0646 \u062A\u0623\u062C\u064A\u0644\u0647\u0627

\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062A\u0635\u0646\u064A\u0641\u0647\u0627:
${JSON.stringify(compactTasks, null, 2)}

\u0623\u0639\u062F \u0627\u0644\u0646\u062A\u064A\u062C\u0629 \u0628\u0635\u064A\u063A\u0629 JSON \u0645\u0637\u0627\u0628\u0642\u0629 \u0644\u0644\u0645\u062E\u0637\u0637 \u0628\u062D\u064A\u062B \u062A\u0634\u0645\u0644 \u0643\u0644 \u0645\u0639\u0631\u0641 (id) \u0641\u064A \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0645\u0639 category \u0648 priority \u0648\u0633\u0628\u0628 \u0645\u062E\u062A\u0635\u0631 \u0628\u0627\u0644\u0639\u0631\u0628\u064A\u0629 (reason)\u060C \u0628\u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u0625\u0644\u0649 \u0645\u0644\u062E\u0635 \u0639\u0627\u0645 (summary).
`;
    const response = await generateContentSmart("/api/twin/classify-tasks", {
      contents: prompt,
      thinkingLevel: import_genai.ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          classifications: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                id: { type: import_genai.Type.STRING },
                category: {
                  type: import_genai.Type.STRING,
                  description: "work | personal | health | study | urgent"
                },
                priority: {
                  type: import_genai.Type.STRING,
                  description: "high | medium | low"
                },
                reason: { type: import_genai.Type.STRING }
              },
              required: ["id", "category", "priority"]
            }
          },
          summary: { type: import_genai.Type.STRING }
        },
        required: ["classifications", "summary"]
      }
    });
    const parsed = JSON.parse((response.text ?? "{}").trim());
    res.json({
      classifications: Array.isArray(parsed.classifications) ? parsed.classifications : [],
      summary: parsed.summary || "\u062A\u0645 \u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u0645\u0647\u0627\u0645 \u0648\u062A\u062D\u062F\u064A\u062F \u0623\u0648\u0644\u0648\u064A\u0627\u062A\u0647\u0627 \u0628\u0646\u062C\u0627\u062D."
    });
  } catch (error) {
    console.error("Error in /api/twin/classify-tasks:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u0627\u0644\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0644\u0644\u0645\u0647\u0627\u0645 \u0639\u0628\u0631 Gemini" });
  }
});
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
      currentDate
    } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "\u0646\u0635 \u0627\u0644\u0631\u0633\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628 \u0644\u0644\u062A\u062D\u062F\u062B \u0645\u0639 \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0631\u0642\u0645\u064A" });
    }
    const nowDate = currentDate ? new Date(currentDate) : /* @__PURE__ */ new Date();
    const gregorianDateStr = nowDate.toLocaleDateString("ar-SA-u-ca-gregory", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const hijriDateStr = nowDate.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const compactTasks = (Array.isArray(tasks) ? tasks : []).slice(0, 20).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      category: t.category,
      dueDate: t.dueDate,
      dueTime: t.dueTime
    }));
    const compactSchedule = (Array.isArray(schedule) ? schedule : []).slice(0, 15).map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      title: b.title,
      category: b.category,
      isCompleted: b.isCompleted
    }));
    const compactGoals = (Array.isArray(goals) ? goals : []).slice(0, 8).map((g) => ({
      title: g.title,
      progress: g.progress,
      targetDate: g.targetDate
    }));
    const compactQuran = (Array.isArray(quranRoutine) ? quranRoutine : []).map((q) => ({
      title: q.title,
      targetAmount: q.targetAmount,
      completed: q.completed,
      timeSlot: q.timeSlot
    }));
    const systemInstruction = `
\u0623\u0646\u062A "\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0631\u0642\u0645\u064A AI" \u0648\u0627\u0644\u062A\u0648\u0623\u0645 \u0627\u0644\u0630\u0643\u064A \u0627\u0644\u0634\u062E\u0635\u064A \u0644\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"}).
\u062A\u062C\u0645\u0639 \u0628\u064A\u0646 \u062F\u0648\u0631 \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u064A\u060C \u0648\u0645\u062E\u0637\u0637 \u0627\u0644\u064A\u0648\u0645\u060C \u0648\u0627\u0644\u0645\u0648\u062C\u0651\u0647 \u0627\u0644\u0634\u062E\u0635\u064A \u0627\u0644\u0645\u062A\u0643\u0627\u0645\u0644 \u0645\u0639 \u0627\u0644\u0645\u0647\u0627\u0645\u060C \u0627\u0644\u062A\u0642\u0648\u064A\u0645 \u0627\u0644\u0647\u062C\u0631\u064A \u0648\u0627\u0644\u0645\u064A\u0644\u0627\u062F\u064A\u060C \u0627\u0644\u0623\u0647\u062F\u0627\u0641 \u0628\u0639\u064A\u062F\u0629 \u0627\u0644\u0645\u062F\u0649\u060C \u0648\u0648\u0631\u062F \u0627\u0644\u0642\u0631\u0622\u0646 \u0648\u0627\u0644\u0623\u0630\u0643\u0627\u0631.

\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u064A\u0648\u0645 \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E:
- \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0647\u062C\u0631\u064A: ${hijriDateStr}
- \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u064A\u0644\u0627\u062F\u064A: ${gregorianDateStr}
- \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u062D\u0627\u0644\u064A: ${nowDate.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}

\u0645\u0644\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645:
- \u0627\u0644\u0627\u0633\u0645: ${profile?.name || "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645"}
- \u0627\u0644\u062F\u0648\u0631/\u0627\u0644\u0645\u0647\u0646\u0629: ${profile?.role || "\u0645\u062D\u062A\u0631\u0641"}
- \u0633\u0627\u0639\u0627\u062A \u0627\u0644\u0630\u0631\u0648\u0629: ${profile?.peakEnergy || "\u0635\u0628\u0627\u062D\u064A\u0629"}
- \u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u0639\u0645\u0644: ${profile?.workStyle || "\u062C\u0644\u0633\u0627\u062A \u062A\u0631\u0643\u064A\u0632 45 \u062F\u0642\u064A\u0642\u0629"}
- \u0627\u0644\u0623\u0647\u062F\u0627\u0641 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629: ${profile?.mainGoals || "\u0627\u0644\u0625\u0646\u062A\u0627\u062C\u064A\u0629 \u0648\u0627\u0644\u062A\u0648\u0627\u0632\u0646"}
- \u0623\u0633\u0644\u0648\u0628 \u0627\u0644\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0637\u0644\u0648\u0628: ${profile?.tone || "\u0639\u0645\u0644\u064A\u060C \u0630\u0643\u064A\u060C \u0645\u0634\u062C\u0639"}
- \u0627\u0644\u0642\u0648\u0627\u0639\u062F \u0627\u0644\u0630\u0647\u0628\u064A\u0629: ${profile?.rules || ""}

\u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 (${Array.isArray(tasks) ? tasks.length : 0}):
${JSON.stringify(compactTasks)}

\u062C\u062F\u0648\u0644 \u0627\u0644\u064A\u0648\u0645 (${Array.isArray(schedule) ? schedule.length : 0}):
${JSON.stringify(compactSchedule)}

\u0627\u0644\u0623\u0647\u062F\u0627\u0641 \u0628\u0639\u064A\u062F\u0629 \u0627\u0644\u0645\u062F\u0649 (${Array.isArray(goals) ? goals.length : 0}):
${JSON.stringify(compactGoals)}

\u0648\u0631\u062F \u0627\u0644\u0642\u0631\u0622\u0646 \u0627\u0644\u064A\u0648\u0645\u064A:
${JSON.stringify(compactQuran)}

\u062D\u0627\u0644\u0629 \u0627\u0644\u0623\u0630\u0643\u0627\u0631 \u0627\u0644\u064A\u0648\u0645\u064A\u0629:
${JSON.stringify(adhkarState || {})}

\u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u0625\u062E\u0631\u0627\u062C \u0627\u0644\u0635\u0627\u0631\u0645\u0629:
1. \u0623\u062C\u0628 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0648\u0627\u0636\u062D\u0629 \u0648\u0627\u0644\u0639\u0645\u0644\u064A\u0629\u060C \u0648\u0631\u062A\u0628 \u0646\u0635\u064A\u062D\u062A\u0643 \u0623\u0648 \u062E\u0637\u062A\u0643 \u0628\u0646\u0642\u0627\u0637 \u0645\u062E\u062A\u0635\u0631\u0629 \u0648\u0645\u0628\u0627\u0634\u0631\u0629 \u0641\u064A \u062D\u0642\u0644 "reply".
2. \u0625\u0630\u0627 \u0637\u0644\u0628 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0625\u0636\u0627\u0641\u0629 \u0645\u0647\u0627\u0645 \u0623\u0648 \u0627\u0642\u062A\u0631\u062D\u062A \u0644\u0647 \u062E\u0637\u0629 \u0639\u0645\u0644\u060C \u0636\u0639 \u0627\u0644\u0645\u0647\u0627\u0645 \u0627\u0644\u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0625\u062F\u0631\u0627\u062C \u0645\u0628\u0627\u0634\u0631\u0629 \u0641\u064A "suggestedTasks" (\u0648\u0625\u0644\u0627 \u0623\u0639\u062F \u0645\u0635\u0641\u0648\u0641\u0629 \u0641\u0627\u0631\u063A\u0629 []).
3. \u0625\u0630\u0627 \u0630\u064F\u0643\u0631\u062A \u0623\u0648\u0642\u0627\u062A \u0623\u0648 \u0645\u0648\u0627\u0639\u064A\u062F \u0623\u0648 \u0627\u0642\u062A\u0631\u062D\u062A \u062A\u0648\u0632\u064A\u0639\u0627\u064B \u0632\u0645\u0646\u064A\u0627\u064B\u060C \u0636\u0639 \u0627\u0644\u0643\u062A\u0644 \u0627\u0644\u0632\u0645\u0646\u064A\u0629 \u0628\u0635\u064A\u063A\u0629 24 \u0633\u0627\u0639\u0629 (HH:MM) \u0641\u064A "suggestedEvents" (\u0648\u0625\u0644\u0627 []).
4. \u0625\u0630\u0627 \u0637\u0644\u0628 \u0623\u0648 \u0627\u062D\u062A\u0627\u062C \u0647\u062F\u0641\u0627\u064B \u0628\u0639\u064A\u062F \u0627\u0644\u0645\u062F\u0649\u060C \u0636\u0639\u0647 \u0641\u064A "suggestedGoals" (\u0648\u0625\u0644\u0627 []).
5. \u0641\u064A "suggestedAction" \u062D\u062F\u062F \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u0641\u0648\u0631\u064A \u0627\u0644\u0623\u0646\u0633\u0628:
   - "start_focus" \u0625\u0630\u0627 \u0643\u0627\u0646 \u0627\u0644\u0623\u0646\u0633\u0628 \u0628\u062F\u0621 \u062C\u0644\u0633\u0629 \u062A\u0631\u0643\u064A\u0632 \u0627\u0644\u0622\u0646 \u0639\u0644\u0649 \u0645\u0647\u0645\u0629 \u0645\u062D\u062F\u062F\u0629 (\u0645\u0639 \u0648\u0636\u0639 taskId \u0627\u0644\u0635\u062D\u064A\u062D \u0645\u0646 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0647\u0627\u0645 \u0625\u0646 \u0648\u062C\u062F).
   - "optimize_schedule" \u0625\u0630\u0627 \u0637\u0644\u0628 \u0625\u0639\u0627\u062F\u0629 \u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u062C\u062F\u0648\u0644 \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A.
   - "open_schedule" \u0625\u0630\u0627 \u0627\u062D\u062A\u0627\u062C \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062C\u062F\u0648\u0644 \u0627\u0644\u064A\u0648\u0645\u064A.
   - "open_tasks" \u0625\u0630\u0627 \u0627\u062D\u062A\u0627\u062C \u0645\u0631\u0627\u062C\u0639\u0629 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0647\u0627\u0645.
   - "none" \u0641\u064A \u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629.
`;
    const contents = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h?.content) {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: String(h.content) }]
          });
        }
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });
    const response = await generateContentSmart("/api/twin/assistant", {
      contents,
      systemInstruction,
      thinkingLevel: import_genai.ThinkingLevel.LOW,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          reply: {
            type: import_genai.Type.STRING,
            description: "\u0631\u062F \u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0631\u0642\u0645\u064A \u0627\u0644\u0634\u0627\u0645\u0644 \u0648\u0627\u0644\u0639\u0645\u0644\u064A \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629"
          },
          suggestedTasks: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                description: { type: import_genai.Type.STRING },
                priority: { type: import_genai.Type.STRING, description: "high | medium | low" },
                category: {
                  type: import_genai.Type.STRING,
                  description: "work | personal | health | study | urgent"
                },
                estimatedMinutes: { type: import_genai.Type.INTEGER },
                dueDate: { type: import_genai.Type.STRING },
                dueTime: { type: import_genai.Type.STRING }
              },
              required: ["title", "priority", "category"]
            }
          },
          suggestedEvents: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                startTime: { type: import_genai.Type.STRING, description: "HH:MM 24h" },
                endTime: { type: import_genai.Type.STRING, description: "HH:MM 24h" },
                category: {
                  type: import_genai.Type.STRING,
                  description: "deep_work | meeting | routine | health | personal | review"
                }
              },
              required: ["title", "startTime", "endTime"]
            }
          },
          suggestedGoals: {
            type: import_genai.Type.ARRAY,
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                title: { type: import_genai.Type.STRING },
                category: {
                  type: import_genai.Type.STRING,
                  description: "work | personal | learning | health"
                },
                targetDate: { type: import_genai.Type.STRING },
                progress: { type: import_genai.Type.INTEGER }
              },
              required: ["title", "category", "targetDate"]
            }
          },
          suggestedAction: {
            type: import_genai.Type.OBJECT,
            properties: {
              type: {
                type: import_genai.Type.STRING,
                description: "start_focus | optimize_schedule | open_schedule | open_tasks | none"
              },
              label: { type: import_genai.Type.STRING },
              taskId: { type: import_genai.Type.STRING }
            },
            required: ["type", "label"]
          }
        },
        required: ["reply", "suggestedTasks", "suggestedEvents", "suggestedGoals", "suggestedAction"]
      }
    });
    const parsed = JSON.parse((response.text ?? "{}").trim());
    res.json({
      reply: parsed.reply || "\u0623\u0646\u0627 \u0645\u0639\u0643 \u0627\u0644\u0622\u0646\u061B \u062F\u0639\u0646\u0627 \u0646\u0631\u062A\u0628 \u0623\u0647\u0645 \u0645\u0647\u0627\u0645\u0643 \u0648\u0646\u0628\u062F\u0623 \u0628\u0627\u0644\u062E\u0637\u0648\u0629 \u0627\u0644\u0623\u0639\u0644\u0649 \u0623\u062B\u0631\u0627\u064B \u0641\u064A \u064A\u0648\u0645\u0643.",
      suggestedTasks: Array.isArray(parsed.suggestedTasks) ? parsed.suggestedTasks : [],
      suggestedEvents: Array.isArray(parsed.suggestedEvents) ? parsed.suggestedEvents : [],
      suggestedGoals: Array.isArray(parsed.suggestedGoals) ? parsed.suggestedGoals : [],
      suggestedAction: parsed.suggestedAction || { type: "none", label: "" }
    });
  } catch (error) {
    console.error("Error in /api/twin/assistant:", error);
    res.status(500).json({ error: error.message || "\u0641\u0634\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0645\u0633\u0627\u0639\u062F \u0627\u0644\u0631\u0642\u0645\u064A AI" });
  }
});
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
});
async function startServer() {
  const httpServer = import_http.default.createServer(app);
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
    const vite = await (0, import_vite.createServer)({
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
                  server: httpServer
                }
              }
            };
          },
          configResolved(resolvedConfig) {
            if (!hmrDisabled && resolvedConfig.server.hmr !== false) {
              resolvedConfig.server.hmr = {
                ...typeof resolvedConfig.server.hmr === "object" ? resolvedConfig.server.hmr : {},
                server: httpServer
              };
            }
          }
        }
      ],
      server: {
        middlewareMode: true,
        ws: hmrDisabled ? false : void 0,
        hmr: hmrDisabled ? false : { server: httpServer }
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Digital Twin Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
