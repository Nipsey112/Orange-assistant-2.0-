export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatResponse {
  message: string;
  suggestedQuestions?: string[];
  timestamp: string;
}

export interface QuickAccessTopic {
  id: string;
  label: string;
  icon: string;
  message: string;
}

export interface CommunityStats {
  members: string;
  revenue: string;
  projects: string;
}
