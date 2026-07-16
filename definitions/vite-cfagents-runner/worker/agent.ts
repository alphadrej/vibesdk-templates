import { Agent } from 'agents';
import { DEFAULT_MODEL, isAllowedModel } from '../shared/models';
import type { Env as CoreEnv } from './core-utils';
import type { ChatState } from './types';
import { ChatHandler } from './chat';
import {
  API_RESPONSES,
  CHAT_RATE_LIMIT_MAX_REQUESTS,
  CHAT_RATE_LIMIT_WINDOW_MS
} from './config';
import { createMessage, createStreamResponse, createEncoder } from './utils';

type AgentEnv = CoreEnv & {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
};

/**
 * ChatAgent - Main agent class using Cloudflare Agents SDK
 * 
 * This class extends the Agents SDK Agent class and handles all chat operations.
 */
export class ChatAgent extends Agent<AgentEnv, ChatState> {
  private chatHandler?: ChatHandler;

  // Initial state for new chat sessions
  initialState: ChatState = {
    messages: [],
    sessionId: crypto.randomUUID(),
    isProcessing: false,
    model: DEFAULT_MODEL
  };

  private getSafeModel() {
    const model = isAllowedModel(this.state.model) ? this.state.model : DEFAULT_MODEL;

    if (model !== this.state.model) {
      this.setState({ ...this.state, model });
    }

    return model;
  }

  private initializeChatHandler(): ChatHandler | undefined {
    const apiKey = this.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      this.chatHandler = undefined;
      return undefined;
    }

    if (!this.chatHandler) {
      const baseURL = this.env.OPENAI_BASE_URL?.trim() || undefined;
      this.chatHandler = new ChatHandler(apiKey, this.getSafeModel(), baseURL);
    }

    return this.chatHandler;
  }

  private isAIConfigured(): boolean {
    return Boolean(this.env.OPENAI_API_KEY?.trim());
  }

  private enforceRateLimit(): Response | undefined {
    const now = Date.now();
    const current = this.state.rateLimit;
    const isCurrentWindow = Boolean(
      current &&
      now >= current.windowStartedAt &&
      now - current.windowStartedAt < CHAT_RATE_LIMIT_WINDOW_MS
    );
    const windowStartedAt = isCurrentWindow && current ? current.windowStartedAt : now;
    const requestCount = isCurrentWindow && current ? current.requestCount : 0;

    if (requestCount >= CHAT_RATE_LIMIT_MAX_REQUESTS) {
      const retryAfter = Math.max(
        1,
        Math.ceil((windowStartedAt + CHAT_RATE_LIMIT_WINDOW_MS - now) / 1000)
      );

      return Response.json({
        success: false,
        error: API_RESPONSES.RATE_LIMIT_EXCEEDED,
        retryAfter
      }, {
        status: 429,
        headers: { 'Retry-After': String(retryAfter) }
      });
    }

    this.setState({
      ...this.state,
      rateLimit: {
        windowStartedAt,
        requestCount: requestCount + 1
      }
    });

    return undefined;
  }

  /**
   * Initialize chat handler when agent starts
   */
  async onStart(): Promise<void> {
    this.initializeChatHandler();
    
    console.log(`ChatAgent ${this.name} initialized with session ${this.state.sessionId}`);
  }

  /**
   * Handle incoming requests - clean routing with error handling
   */
  async onRequest(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);
      const method = request.method;

      // Route to appropriate handler
      if (method === 'GET' && url.pathname === '/messages') {
        return this.handleGetMessages();
      }
      
      if (method === 'POST' && url.pathname === '/chat') {
        return this.handleChatMessage(await request.json());
      }
      
      if (method === 'DELETE' && url.pathname === '/clear') {
        return this.handleClearMessages();
      }

      if (method === 'POST' && url.pathname === '/model') {
        return this.handleModelUpdate(await request.json());
      }
      
      return Response.json({ 
        success: false, 
        error: API_RESPONSES.NOT_FOUND 
      }, { status: 404 });

    } catch (error) {
      console.error('Request handling error:', error);
      return Response.json({ 
        success: false, 
        error: API_RESPONSES.INTERNAL_ERROR 
      }, { status: 500 });
    }
  }

  /**
   * Get current conversation messages
   */
  private handleGetMessages(): Response {
    return Response.json({ 
      success: true, 
      data: this.state,
      aiConfigured: this.isAIConfigured()
    });
  }

  /**
   * Process new chat message
   */
  private async handleChatMessage(body: { message?: unknown; model?: unknown; stream?: unknown }): Promise<Response> {
    const { message, model, stream } = body;

    // Validate input
    if (typeof message !== 'string' || !message.trim()) {
      return Response.json({ 
        success: false, 
        error: API_RESPONSES.MISSING_MESSAGE 
      }, { status: 400 });
    }

    if (model !== undefined && !isAllowedModel(model)) {
      return Response.json({
        success: false,
        error: API_RESPONSES.INVALID_MODEL
      }, { status: 400 });
    }

    const chatHandler = this.initializeChatHandler();
    if (!chatHandler) {
      return Response.json({
        success: false,
        error: API_RESPONSES.AI_NOT_CONFIGURED,
        aiConfigured: false
      }, { status: 503 });
    }

    const rateLimitResponse = this.enforceRateLimit();
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Update model if provided
    if (model !== undefined && model !== this.state.model) {
      this.setState({ ...this.state, model });
      chatHandler.updateModel(model);
    }
    
    const userMessage = createMessage('user', message.trim());
    
    this.setState({
      ...this.state,
      messages: [...this.state.messages, userMessage],
      isProcessing: true
    });
    
    try {
      if (stream === true) {
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = createEncoder();
        
        // Start processing in background
        (async () => {
          try {
            this.setState({ ...this.state, streamingMessage: '' });
            
            const response = await chatHandler.processMessage(
              message, 
              this.state.messages,
              (chunk: string) => {
                try {
                  this.setState({ 
                    ...this.state, 
                    streamingMessage: (this.state.streamingMessage || '') + chunk 
                  });
                  writer.write(encoder.encode(chunk));
                } catch (writeError) {
                  console.error('Write error:', writeError);
                }
              }
            );

            const assistantMessage = createMessage('assistant', response.content, response.toolCalls);
            
            // Update state with final response
            this.setState({
              ...this.state,
              messages: [...this.state.messages, assistantMessage],
              isProcessing: false,
              streamingMessage: ''
            });
            
          } catch (error) {
            console.error('Streaming error:', error);
            
            // Write error to stream
            try {
              const errorMessage = 'Sorry, I encountered an error processing your request.';
              writer.write(encoder.encode(errorMessage));
              
              const errorMsg = createMessage('assistant', errorMessage);
              this.setState({
                ...this.state,
                messages: [...this.state.messages, errorMsg],
                isProcessing: false,
                streamingMessage: ''
              });
            } catch (writeError) {
              console.error('Error writing error message:', writeError);
            }
          } finally {
            try {
              writer.close();
            } catch (closeError) {
              console.error('Error closing writer:', closeError);
            }
          }
        })();

        return createStreamResponse(readable);
      }

      // Non-streaming response
      const response = await chatHandler.processMessage(
        message, 
        this.state.messages
      );

      const assistantMessage = createMessage('assistant', response.content, response.toolCalls);
      
      // Update state with response
      this.setState({
        ...this.state,
        messages: [...this.state.messages, assistantMessage],
        isProcessing: false
      });
      
      return Response.json({ 
        success: true, 
        data: this.state 
      });

    } catch (error) {
      console.error('Chat processing error:', error);
      this.setState({ ...this.state, isProcessing: false });
      return Response.json({ 
        success: false, 
        error: API_RESPONSES.PROCESSING_ERROR 
      }, { status: 500 });
    }
  }

  /**
   * Clear conversation history
   */
  private handleClearMessages(): Response {
    this.setState({ 
      ...this.state, 
      messages: [] 
    });
    return Response.json({ 
      success: true, 
      data: this.state 
    });
  }

  /**
   * Update selected AI model
   */
  private handleModelUpdate(body: { model?: unknown }): Response {
    const { model } = body;

    if (!isAllowedModel(model)) {
      return Response.json({
        success: false,
        error: API_RESPONSES.INVALID_MODEL
      }, { status: 400 });
    }
    
    this.setState({ ...this.state, model });
    this.initializeChatHandler()?.updateModel(model);
    
    return Response.json({ 
      success: true, 
      data: this.state 
    });
  }
}
