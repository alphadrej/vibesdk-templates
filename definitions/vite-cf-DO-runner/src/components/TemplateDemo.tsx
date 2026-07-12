import { useEffect, useState } from 'react'
import { Cpu, Database } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ApiResponse, DemoItem } from '@shared/types'

export const HAS_TEMPLATE_DEMO = true

const cardClass = 'border-border shadow-sm'
const rowClass = 'flex items-center justify-between rounded-md border bg-muted/40 p-2'

export function TemplateDemo() {
  const [counter, setCounter] = useState<number>(0)
  const [demoItems, setDemoItems] = useState<DemoItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/counter').then((res) => res.json()),
      fetch('/api/demo').then((res) => res.json()),
    ])
      .then(([counterData, itemsData]: [ApiResponse<number>, ApiResponse<DemoItem[]>]) => {
        if (counterData.success) setCounter(counterData.data ?? 0)
        if (itemsData.success) setDemoItems(itemsData.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const incrementCounter = async () => {
    const res = await fetch('/api/counter/increment', { method: 'POST' })
    const data = (await res.json()) as ApiResponse<number>
    if (data.success && data.data !== undefined) setCounter(data.data)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            Durable Object Storage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : demoItems.length ? (
            demoItems.map((item) => (
              <div key={item.id} className={rowClass}>
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">Value: {item.value}</span>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No items yet.</div>
          )}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-muted-foreground" />
            Durable Object Counter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-4xl font-bold tabular-nums">{counter}</p>
            <p className="text-sm text-muted-foreground">Persistent across refresh</p>
          </div>
          <Button onClick={incrementCounter} className="w-full" variant="outline">
            Increment
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
