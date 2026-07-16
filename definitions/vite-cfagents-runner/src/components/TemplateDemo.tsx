import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, KeyRound, Send, User } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { chatService, MODELS } from '@/lib/chat'
import type { ChatState, Message } from '../../worker/types'

export const HAS_TEMPLATE_DEMO = true

export function TemplateDemo() {
  const [model, setModel] = useState<string>(MODELS[0]?.id ?? 'gpt-4o-mini')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null)
  const [error, setError] = useState<string>()
  const endRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async () => {
    const res = await chatService.getMessages()
    if (typeof res.aiConfigured === 'boolean') {
      setAiConfigured(res.aiConfigured)
    }
    if (res.success && res.data) {
      const data = res.data as ChatState
      setMessages(data.messages)
      setError(undefined)
    } else if (res.error) {
      setError(res.error)
    }
  }, [])

  useEffect(() => {
    loadMessages().catch(() => {})
  }, [loadMessages])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading || aiConfigured === false) return
    setInput('')
    setLoading(true)

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])

    const res = await chatService.sendMessage(text, model)
    if (res.aiConfigured === false) {
      setAiConfigured(false)
      setError(undefined)
      await loadMessages()
    } else if (res.success) {
      setError(undefined)
      await loadMessages()
    } else {
      setError(res.error || 'Failed to send message')
    }
    setLoading(false)
  }

  return (
    <Card className="mx-auto flex h-[55vh] max-w-5xl flex-col border-border shadow-sm">
      <div className="p-4 border-b flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
          <Bot className="h-4 w-4 text-primary-foreground" />
        </div>
        <h2 className="font-display font-bold text-lg">Chat demo</h2>

        <Select value={model} onValueChange={setModel} disabled={aiConfigured === false}>
          <SelectTrigger className="w-56 ml-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {aiConfigured === false ? (
        <Alert className="m-4 mb-0 w-auto border-amber-500/50 bg-amber-500/10">
          <KeyRound className="h-4 w-4" />
          <AlertTitle>AI not configured - add your OPENAI_API_KEY secret</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Ask this app&apos;s builder to add their OpenAI API key through Lumaveno. The rest of the app remains available.
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => loadMessages().catch(() => {})}>
              Check again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="m-4 mb-0 w-auto">
          <AlertTitle>Chat unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Try asking: <span className="font-medium">"What tools do you have?"</span>
          </div>
        ) : null}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              <div className="flex items-center gap-2 mb-1 opacity-80">
                {m.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                <span className="text-xs">{new Date(m.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="p-4 border-t flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send().catch(() => {})
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={aiConfigured === false ? 'Add OPENAI_API_KEY to enable AI chat' : loading ? 'Waiting for response…' : 'Send a message'}
          disabled={aiConfigured === false}
          className="min-h-[44px] max-h-28"
        />
        <Button type="submit" disabled={loading || aiConfigured === false || !input.trim()} className="shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  )
}
