import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export const geminiService = {
  async parseVoiceInput(text: string) {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following financial transaction from natural language: "${text}". 
      Return the data in the specified JSON format. 
      If the user says "I spent", it's an expense. If they say "I received" or "I earned", it's an income.
      Categories should be one of: Food, Travel, Bills, Shopping, Entertainment, Health, Salary, Other.
      Current date is ${new Date().toISOString()}.`,
      config: {
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

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return null;
    }
  },

  async parseReceipt(base64Image: string, mimeType: string) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType } },
          { text: "Extract the total amount, merchant name (as title), and date from this receipt. Return as JSON." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Merchant or store name" },
            amount: { type: Type.NUMBER, description: "Total amount on the receipt" },
            category: { type: Type.STRING, description: "Likely category (e.g., Food, Shopping)" },
            date: { type: Type.STRING, description: "ISO 8601 date string" }
          },
          required: ["title", "amount", "category", "date"]
        }
      }
    });

      try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return null;
    }
  },

  async getInsights(prompt: string): Promise<string[]> {
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

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return ["Review your spending in the 'Reports' tab.", "Set a budget to reach your financial goals faster."];
    }
  }
};
