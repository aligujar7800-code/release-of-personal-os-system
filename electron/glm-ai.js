const { OpenAI } = require('openai');

/**
 * GLMService handles communication with the GLM-5.1 model on Hugging Face.
 */
class GLMService {
    constructor(apiKey) {
        this.client = new OpenAI({
            baseURL: "https://router.huggingface.co/v1",
            apiKey: apiKey || process.env.HF_TOKEN,
        });
        this.model = "zai-org/GLM-5.1:novita";
    }

    /**
     * Generates a response from GLM-5.1 based on a question and retrieved context.
     * @param {string} question - The user's question.
     * @param {string} context - Context retrieved from the Personal Digital Memory.
     * @returns {Promise<Object>} - The AI response.
     */
    async generateResponse(question, context) {
        try {
            const systemPrompt = `You are a helpful and intelligent Personal Digital Memory Assistant. 
Your goal is to help the user recall their activities, find files, and summarize their digital life.

Use the following "Context" retrieved from the user's personal database to answer the question.
If the context doesn't contain the answer, be honest and say you don't know, but try to be as helpful as possible with the information you have.
Format your response using Markdown. Use boldING and lists to make it readable.

CONTEXT:
${context}

Always refer to the context when answering questions about the user's specific activities.`;

            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: question },
                ],
                temperature: 0.7,
                max_tokens: 1000,
            });

            return {
                answer: completion.choices[0].message.content,
                model: this.model,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('GLM-5.1 Inference Error:', error);
            throw error;
        }
    }
}

module.exports = { GLMService };
