import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "your-api-key-here"
});

export interface ChatResponse {
  message: string;
  suggestedQuestions?: string[];
}

export async function generateChatResponse(
  userMessage: string,
  context: string[] = []
): Promise<ChatResponse> {
  try {
    const systemPrompt = `You are Orange Assistant, an AI chatbot representing the Orange Dynasty community and Sign Protocol ecosystem. You are knowledgeable, friendly, and enthusiastic about the orange-themed branding.

Your knowledge includes:
- Sign Protocol: Omnichain attestation infrastructure for verifying information across blockchains
- TokenTable: Token management platform ($4B+ in distributions, 40M+ wallets)
- SignPass: Decentralized identity solution serving as digital passport
- EthSign: Decentralized electronic agreement platform
- Orange Dynasty: 50K+ member community with orange branding, SBTs, NFTs, and rewards
- Team: CEO Xin Yan, founded in 2021, $15M ARR, $28M funding
- Community culture: "Lead with love", SignGlasses symbol, orange backgrounds

Always respond in a helpful, enthusiastic tone. Use orange/fire emojis appropriately. Keep responses concise but informative. When appropriate, suggest related questions users might ask.

If asked about topics outside your knowledge area, politely redirect to Sign Protocol/Orange Dynasty topics.`;

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...context.map(msg => ({ role: "assistant" as const, content: msg })),
      { role: "user", content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const message = response.choices[0].message.content || "I'm sorry, I couldn't generate a response. Please try asking about Sign Protocol or the Orange Dynasty community!";

    // Generate suggested questions based on the response
    const suggestionsResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Based on the conversation about Sign Protocol and Orange Dynasty, suggest 3 short follow-up questions (max 6 words each) that users might want to ask. Return as JSON array."
        },
        {
          role: "user",
          content: `User asked: "${userMessage}"\nAssistant responded: "${message}"\n\nSuggest 3 follow-up questions:`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    let suggestedQuestions: string[] = [];
    try {
      const suggestions = JSON.parse(suggestionsResponse.choices[0].message.content || '{"questions": []}');
      suggestedQuestions = suggestions.questions || suggestions.suggestions || [];
    } catch (error) {
      // Fallback suggestions
      suggestedQuestions = [
        "Tell me about $SIGN token",
        "What is Orange Dynasty?",
        "How does TokenTable work?"
      ];
    }

    return {
      message,
      suggestedQuestions: suggestedQuestions.slice(0, 3)
    };

  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate response. Please check your OpenAI API key and try again.");
  }
}
