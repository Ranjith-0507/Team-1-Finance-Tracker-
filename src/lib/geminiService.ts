export const geminiService = {
  async parseVoiceInput(text: string) {
    try {
      const response = await fetch("/api/ai/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!response.ok) throw new Error("Server error");
      return await response.json();
    } catch (e) {
      console.error("Failed to call server for voice parsing", e);
      return null;
    }
  },

  async parseDocument(base64: string, mimeType: string) {
    try {
      const response = await fetch("/api/ai/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType })
      });
      if (!response.ok) throw new Error("Server error");
      return await response.json();
    } catch (e) {
      console.error("Failed to call server for document parsing", e);
      return null;
    }
  },

  async getInsights(prompt: string): Promise<string[]> {
    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      if (!response.ok) throw new Error("Server error");
      return await response.json();
    } catch (e) {
      console.error("Failed to call server for insights", e);
      return ["Review your spending in the 'Reports' tab.", "Set a budget to reach your financial goals faster."];
    }
  }
};
