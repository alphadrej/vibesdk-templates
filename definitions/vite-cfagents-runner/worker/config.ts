export const API_RESPONSES = {
  MISSING_MESSAGE: 'Message required',
  INVALID_MODEL: 'Invalid model',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  AI_NOT_CONFIGURED: 'AI not configured - add your OPENAI_API_KEY secret',
  PROCESSING_ERROR: 'Failed to process message',
  NOT_FOUND: 'Not Found',
  AGENT_ROUTING_FAILED: 'Agent routing failed',
  INTERNAL_ERROR: 'Internal Server Error'
} as const;

export const MAX_OUTPUT_TOKENS = 2048;
export const CHAT_RATE_LIMIT_MAX_REQUESTS = 10;
export const CHAT_RATE_LIMIT_WINDOW_MS = 60_000;
