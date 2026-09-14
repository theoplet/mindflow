/**
 * AI module using Google Gemini API for generating and expanding mind maps.
 */
export class AI {
  constructor() {
    this.apiKey = '';
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    this.isGenerating = false;
  }

  /**
   * Initialize - load API key from storage.
   */
  init() {
    try {
      this.apiKey = localStorage.getItem('mindflow_ai_key') || '';
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Save API key to storage.
   * @param {string} key - The API key.
   */
  setApiKey(key) {
    this.apiKey = key;
    try {
      localStorage.setItem('mindflow_ai_key', key);
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Check if API key is set.
   * @returns {boolean}
   */
  hasApiKey() {
    return this.apiKey.length > 0;
  }

  /**
   * Generate a full mindmap from a text prompt.
   * @param {string} prompt - The user prompt.
   * @returns {Promise<Object>} The generated mind map root node.
   */
  async generateMindmap(prompt) {
    if (!this.hasApiKey()) throw new Error('API key not set');
    if (this.isGenerating) throw new Error('Already generating');
    
    this.isGenerating = true;
    try {
      const systemPrompt = `You are a mind map generator. Given a topic, create a structured mind map in JSON format.
      
Rules:
- The root node represents the main topic
- Create 4-6 main branches (children of root)
- Each main branch should have 2-4 sub-branches
- Keep text concise (2-5 words per node)
- Assign appropriate emoji icons to main branches
- Assign colors from this palette: #6C5CE7, #3B82F6, #14B8A6, #22C55E, #EAB308, #F97316, #EF4444, #EC4899

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "text": "Main Topic",
  "icon": "🎯",
  "color": "#6C5CE7",
  "children": [
    {
      "text": "Branch 1",
      "icon": "💡",
      "color": "#3B82F6",
      "children": [
        { "text": "Sub-topic 1.1", "icon": "", "color": "#3B82F6", "children": [] },
        { "text": "Sub-topic 1.2", "icon": "", "color": "#3B82F6", "children": [] }
      ]
    }
  ]
}`;

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: systemPrompt },
              { text: `Create a mind map about: ${prompt}` }
            ]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        let errorMessage = 'API request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from AI');

      // Parse the JSON response
      const mindmapData = JSON.parse(text);
      return this._processAIResponse(mindmapData);
    } catch (error) {
      console.error('AI Generation Error:', error);
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Expand a specific node with AI-generated sub-topics.
   * @param {string} nodeText - Text of the node to expand.
   * @param {Array} existingChildren - Existing children nodes.
   * @returns {Promise<Array>} List of generated child nodes.
   */
  async expandNode(nodeText, existingChildren = []) {
    if (!this.hasApiKey()) throw new Error('API key not set');
    if (this.isGenerating) throw new Error('Already generating');

    this.isGenerating = true;
    try {
      const existingTexts = existingChildren.map(c => c.text).join(', ');
      const prompt = `Given the mind map node "${nodeText}"${existingTexts ? ` which already has these sub-topics: ${existingTexts}` : ''}, suggest 3-4 NEW sub-topics that would expand this idea further.

Respond ONLY with a valid JSON array (no markdown, no explanation):
[
  { "text": "Sub-topic 1", "icon": "💡", "color": "#3B82F6" },
  { "text": "Sub-topic 2", "icon": "🔑", "color": "#14B8A6" }
]`;

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        let errorMessage = 'API request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from AI');

      const suggestions = JSON.parse(text);
      return suggestions.map(s => ({
        text: s.text || 'New Topic',
        icon: s.icon || '',
        color: s.color || '#6C5CE7',
        children: []
      }));
    } catch (error) {
      console.error('AI Expansion Error:', error);
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Process AI response - add missing fields.
   * ID generation is assumed to happen via mindmap/import code later.
   * @param {Object} data - AI generated node data.
   * @returns {Object} Processed node data.
   * @private
   */
  _processAIResponse(data) {
    const process = (node) => {
      return {
        text: node.text || 'Topic',
        icon: node.icon || '',
        color: node.color || '#6C5CE7',
        children: (node.children || []).map(c => process(c)),
        collapsed: false,
        notes: ''
      };
    };
    return process(data);
  }
}
