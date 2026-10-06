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
var import_path = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "10mb" }));
var aiClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var geminiQuotaCooldownUntil = 0;
async function generateGeminiContentWithFallback(ai, promptText) {
  if (Date.now() < geminiQuotaCooldownUntil) {
    return null;
  }
  const modelsToTry = [
    { model: "gemini-3.1-flash-lite", thinkingLevel: import_genai.ThinkingLevel.MINIMAL },
    { model: "gemini-3.8-flash", thinkingLevel: import_genai.ThinkingLevel.LOW }
  ];
  for (let i = 0; i < modelsToTry.length; i++) {
    const { model, thinkingLevel } = modelsToTry[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }]
          }
        ],
        config: {
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel
          }
        }
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err) {
      const errStr = String(err).toLowerCase();
      const isQuotaError = err?.status === 429 || errStr.includes("quota") || errStr.includes("resource_exhausted") || errStr.includes("rate limit");
      if (isQuotaError) {
        geminiQuotaCooldownUntil = Date.now() + 18e4;
        console.log("[Gemini Voice Scribe] Gemini quota limit reached. Auto-switching to high-performance local clinical NLP engine.");
        return null;
      }
      const statusCode = err?.status || err?.code || (errStr.includes("503") ? 503 : 500);
      console.log(`[Gemini Voice Scribe] Model ${model} status ${statusCode}, switching to fallback...`);
      if (i < modelsToTry.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }
  return null;
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/voice-fill", async (req, res) => {
  try {
    const { transcript, currentData } = req.body;
    if (!transcript || typeof transcript !== "string") {
      return res.status(400).json({ success: false, error: "Transcript is required" });
    }
    const ai = getGenAI();
    if (!ai) {
      return res.json({
        success: false,
        fallback: true,
        message: "GEMINI_API_KEY not configured on server; fallback to client parser"
      });
    }
    const todayISO = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const todayHuman = (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const systemPrompt = `You are an expert clinical medical scribe and clinic operations AI for Namana Physiotherapy Clinic.
Today is ${todayHuman} (ISO: ${todayISO}).
Given a spoken medical or administrative voice command/transcript from a physiotherapist or clinic staff, analyze the user's intent, recognize existing patient context, and extract structured actions and clinical fields covering everything from patient demographics, clinical assessment, treatment modalities, to follow-up sessions.

CRITICAL PARSING & EXTRACTION RULES:
1. NATURAL LANGUAGE PATIENT & DIAGNOSIS RECOGNITION:
   - Example transcript: "Sukanya She Is Suffering From Cervical Spondylosis"
     - "name": ONLY "Sukanya" (STRICT RULE: NEVER include phrases like "she is suffering from", "suffering from", "he is", "she has" in the patient name field).
     - "sex": Infer from pronouns ("she" / "her" -> "Female", "he" / "his" -> "Male").
     - "diagnosis": "Cervical Spondylosis" (The condition following "suffering from", "complaining of", "diagnosed with", "having").
   - Example transcript: "Ramesh is suffering from lower back pain with right sciatica"
     - "name": "Ramesh", "sex": "Male", "diagnosis": "Lower Back Pain With Right Sciatica".

2. FEE AND BILLING EXTRACTION:
   - If consultation or session fee is stated as "zero", "0", "nil", "free", "no fee", "zero rupees", "0 rupees", explicitly set "treatmentFee": 0 (and "followUp.fee": 0). Do NOT omit or set to null when spoken as 0 or zero!
   - If numerical fee like 500, 300, 800 is spoken, extract as number.

3. FOLLOW-UP DATE & TIME SCHEDULING (SINGLE OR MULTIPLE DATES):
   - Clinicians often dictate follow-up schedules for SINGLE or MULTIPLE dates:
     - "Follow-up date 25th September at 4:30 PM", "Follow up tomorrow at 10 AM", "Schedule follow up next Monday at 5 PM", "Follow up on Friday":
       - "action": "add_followup"
       - "fields.followUp": { "action": "add", "date": "YYYY-MM-DD", "time": "HH:MM:SS", "notes": "Scheduled follow-up session" }
       - "fields.followUps": [ { "action": "add", "date": "YYYY-MM-DD", "time": "HH:MM:SS", "notes": "Scheduled follow-up session" } ]
     - MULTIPLE DATES: e.g. "Schedule follow-up for 22nd, 24th, and 26th September at 10 AM", "Follow up on tomorrow, 25th September, and 28th September", "Schedule follow up on Monday, Wednesday, and Friday at 4 PM", "Follow-ups on 22nd and 24th":
       - "action": "add_followup"
       - "fields.followUps": Array of objects, one for EACH spoken date, in chronological order, with ISO date "YYYY-MM-DD" and standardized 24-hour time "HH:MM:SS" (e.g. "10:00:00").
       - "fields.followUp": Populate with the FIRST follow-up object.
       - "actionSummary": E.g. "Schedule 3 Follow-up sessions on 2026-09-22, 2026-09-24, 2026-09-26 at 10:00".

3. CRITICAL INTENT RULES:
   - 'create_patient' - ONLY if registering a NEW patient from scratch (e.g. "Add new patient...", "Register patient...", "Create patient...").
   - 'add_followup' - If scheduling or recording a follow-up visit/session for single or multiple dates (e.g., "Schedule follow-up for 22nd, 24th, and 26th September", "Follow up date tomorrow at 10 AM", "Add follow up session today pain scale 4", "Next visit 25th Sept").
   - 'update_followup' - If modifying an existing follow-up session.
   - 'update_patient' - If updating existing patient fields (or if current patient context is present, any field dictation updates that patient).
   - 'find_patient' - e.g. "Open patient Priya", "Find patient Ramesh".
   - 'navigate' - e.g. "Go to monthly report", "Show fees", "IT return", "Backup".
   - 'search' - e.g. "Search 9880517715", "Search frozen shoulder".
   - 'download_pdf' - e.g. "Download case sheet" or "Export PDF".
   - 'create_receipt' - e.g. "Create receipt" or "Generate bill".

JSON schema to return:
{
  "action": "create_patient" | "update_patient" | "add_followup" | "update_followup" | "find_patient" | "navigate" | "search" | "download_pdf" | "create_receipt",
  "targetPatientName": string | null,
  "targetView": "patients" | "monthly" | "fees" | "itreturn" | "backup" | "locum" | null,
  "searchQuery": string | null,
  "actionSummary": string,
  "fields": {
    "name": string | null,
    "age": number | null,
    "sex": "Male" | "Female" | "Other" | null,
    "contact": string | null,
    "address": string | null,
    "height": string | null,
    "weight": string | null,
    "bloodGroup": string | null,
    "date": string | null,
    "time": string | null,
    "diagnosis": string | null,
    "history": string | null,
    "painScaleBefore": number | null,
    "painScaleAfter": number | null,
    "treatmentFee": number | null,
    "paymentMethod": "Cash" | "UPI" | "Card" | "Bank Transfer" | null,
    "visitType": "Clinic" | "Home Visit" | null,
    "referredBy": string | null,
    "seenBy": string | null,
    "comorbid": { "diabetes"?: boolean, "bp"?: boolean, "thyroid"?: boolean, "other"?: boolean, "otherText"?: string },
    "modalities": string[],
    "followUp": {
      "action": "add" | "update" | null,
      "sessionNumber": number | null,
      "date": string | null,
      "time": string | null,
      "notes": string | null,
      "painScaleBefore": number | null,
      "painScaleAfter": number | null,
      "treatmentsGiven": string[],
      "fee": number | null,
      "paymentMethod": "Cash" | "UPI" | "Card" | "Bank Transfer" | null,
      "visitType": "Clinic" | "Home Visit" | null,
      "seenBy": string | null
    },
    "followUps": [
      {
        "action": "add" | "update",
        "sessionNumber": number | null,
        "date": string,
        "time": string | null,
        "notes": string | null,
        "painScaleBefore": number | null,
        "painScaleAfter": number | null,
        "treatmentsGiven": string[],
        "fee": number | null,
        "paymentMethod": "Cash" | "UPI" | "Card" | "Bank Transfer" | null,
        "visitType": "Clinic" | "Home Visit" | null,
        "seenBy": string | null
      }
    ]
  }
}

Return ONLY valid JSON matching this schema. If a field was not mentioned or unchanged, set it to null or omit it.`;
    let text = null;
    try {
      const fullPrompt = `${systemPrompt}

Transcript: "${transcript}"
Current form context: ${JSON.stringify(currentData || {})}`;
      text = await generateGeminiContentWithFallback(ai, fullPrompt);
    } catch (genErr) {
      console.log(
        "[Gemini Voice Scribe] AI models busy or unavailable; smoothly using client-side clinical NLP fallback."
      );
      return res.json({
        success: false,
        fallback: true,
        quotaExceeded: true,
        message: "AI models temporarily experiencing high demand, falling back to local NLP parser"
      });
    }
    if (!text) {
      return res.json({
        success: false,
        fallback: true,
        quotaExceeded: true,
        message: "Using fast local clinical NLP parser"
      });
    }
    let parsed = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }
    const finalFields = parsed.fields && typeof parsed.fields === "object" ? parsed.fields : parsed;
    return res.json({
      success: true,
      action: parsed.action || "update_patient",
      targetPatientName: parsed.targetPatientName || null,
      targetView: parsed.targetView || null,
      searchQuery: parsed.searchQuery || null,
      actionSummary: parsed.actionSummary || null,
      fields: finalFields
    });
  } catch (error) {
    console.log("[Voice Scribe Route] Handled error in /api/voice-fill, returning client fallback response");
    return res.json({
      success: false,
      fallback: true,
      error: error?.message || "Error processing speech"
    });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Namana Physiotherapy Clinic server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
