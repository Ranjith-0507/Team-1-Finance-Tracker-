import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Gemini Initialization (Server-side only)
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  // API Routes
  app.post("/api/ai/parse-voice", async (req, res) => {
    const { text } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Parse the following financial transaction from natural language: "${text}". 
        Return the data in the specified JSON format. 
        If the user says "I spent", it's an expense. If they say "I received" or "I earned", it's an income.
        Categories should be one of: Food, Travel, Bills, Shopping, Entertainment, Health, Salary, Other.
        Current date is ${new Date().toISOString()}.`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Short description of the transaction" },
              amount: { type: Type.NUMBER, description: "The monetary value" },
              category: { type: Type.STRING, description: "The category of the transaction" },
              type: { type: Type.STRING, enum: ["expense", "income"], description: "Whether it's an expense or income" },
              date: { type: Type.STRING, description: "ISO 8601 date string" }
            },
            required: ["title", "amount", "category", "type", "date"]
          }
        }
      });
      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Gemini parse-voice error:", error);
      res.status(500).json({ error: "Failed to parse voice input" });
    }
  });

  app.post("/api/ai/parse-document", async (req, res) => {
    const { base64, mimeType } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: "Exhaustively extract EVERY SINGLE financial transaction from this document (receipt or statement). Do not skip any. For each transaction, provide the title (merchant/description), amount, category, type (expense/income), and date. Return as a JSON array. If the document has multiple pages or many items, ensure all are included." }
          ]
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Merchant or store name" },
                amount: { type: Type.NUMBER, description: "Total amount on the receipt" },
                category: { type: Type.STRING, description: "Likely category (e.g., Food, Shopping, Bills, Salary)" },
                type: { type: Type.STRING, enum: ["expense", "income"], description: "Whether it's an expense or income" },
                date: { type: Type.STRING, description: "ISO 8601 date string" }
              },
              required: ["title", "amount", "category", "type", "date"]
            }
          }
        }
      });
      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Gemini parse-document error:", error);
      res.status(500).json({ error: "Failed to parse document" });
    }
  });

  app.post("/api/ai/insights", async (req, res) => {
    const { prompt } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      res.json(JSON.parse(response.text));
    } catch (error) {
      console.error("Gemini insights error:", error);
      res.status(500).json({ error: "Failed to get insights" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
