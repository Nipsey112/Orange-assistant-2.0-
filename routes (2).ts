import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateChatResponse } from "./services/openai";
import { getKnowledgeContext } from "./services/knowledgeBase";
import { insertChatMessageSchema } from "@shared/schema";
import { z } from "zod";

const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().min(1),
});

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      // Rate limiting
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ 
          message: "Too many requests. Please wait a moment before sending another message." 
        });
      }

      // Validate request
      const { message, sessionId } = chatRequestSchema.parse(req.body);

      // Get conversation context
      const recentMessages = await storage.getChatMessages(sessionId, 5);
      const context = getKnowledgeContext(message);
      const conversationContext = recentMessages
        .filter(msg => msg.role === 'assistant')
        .slice(-2)
        .map(msg => msg.content);

      // Store user message
      await storage.createChatMessage({
        content: message,
        role: 'user',
        sessionId,
      });

      // Generate AI response
      const aiResponse = await generateChatResponse(
        message, 
        [...context, ...conversationContext]
      );

      // Store AI response
      await storage.createChatMessage({
        content: aiResponse.message,
        role: 'assistant',
        sessionId,
      });

      res.json({
        message: aiResponse.message,
        suggestedQuestions: aiResponse.suggestedQuestions || [],
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error("Chat error:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid request format. Please check your message content." 
        });
      }

      res.status(500).json({ 
        message: "I'm having trouble connecting right now. Please try again in a moment!" 
      });
    }
  });

  // Get chat history
  app.get("/api/chat/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessages(sessionId);
      res.json({ messages });
    } catch (error) {
      console.error("Get chat history error:", error);
      res.status(500).json({ message: "Failed to retrieve chat history" });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      service: "Orange Assistant API",
      timestamp: new Date().toISOString() 
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
