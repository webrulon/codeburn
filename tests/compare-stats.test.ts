import { describe, it, expect } from 'vitest'
import { aggregateModelStats, computeComparison, type ModelStats } from '../src/compare-stats.js'
import type { ProjectSummary, SessionSummary, ClassifiedTurn } from '../src/types.js'

function makeTurn(model: string, cost: number, opts: { hasEdits?: boolean; retries?: number; outputTokens?: number; inputTokens?: number; cacheRead?: number; cacheWrite?: number; timestamp?: string } = {}): ClassifiedTurn {
  return {
    timestamp: opts.timestamp ?? '2026-04-15T10:00:00Z',
    category: 'coding',
    retries: opts.retries ?? 0,
    hasEdits: opts.hasEdits ?? false,
    userMessage: '',
    assistantCalls: [{
      provider: 'claude',
      model,
      usage: {
        inputTokens: opts.inputTokens ?? 100,
        outputTokens: opts.outputTokens ?? 200,
        cacheCreationInputTokens: opts.cacheWrite ?? 500,
        cacheReadInputTokens: opts.cacheRead ?? 5000,
        cachedInputTokens: 0,
        reasoningTokens: 0,
        webSearchRequests: 0,
      },
      costUSD: cost,
      tools: opts.hasEdits ? ['Edit'] : ['Read'],
      mcpTools: [],
      hasAgentSpawn: false,
      hasPlanMode: false,
      speed: 'standard' as const,
      timestamp: opts.timestamp ?? '2026-04-15T10:00:00Z',
      bashCommands: [],
      deduplicationKey: `key-${Math.random()}`,
    }],
  }
}

function makeProject(turns: ClassifiedTurn[]): ProjectSummary {
  const session: SessionSummary = {
    sessionId: 'test-session',
    project: 'test-project',
    firstTimestamp: turns[0]?.timestamp ?? '',
    lastTimestamp: turns[turns.length - 1]?.timestamp ?? '',
    totalCostUSD: turns.reduce((s, t) => s + t.assistantCalls.reduce((s2, c) => s2 + c.costUSD, 0), 0),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    apiCalls: turns.reduce((s, t) => s + t.assistantCalls.length, 0),
    turns,
    modelBreakdown: {},
    toolBreakdown: {},
    mcpBreakdown: {},
    bashBreakdown: {},
    categoryBreakdown: {} as SessionSummary['categoryBreakdown'],
  }
  return {
    project: 'test-project',
    projectPath: '/test',
    sessions: [session],
    totalCostUSD: session.totalCostUSD,
    totalApiCalls: session.apiCalls,
  }
}

describe('aggregateModelStats', () => {
  it('aggregates calls, cost, and tokens per model', () => {
    const project = makeProject([
      makeTurn('opus-4-6', 0.10, { outputTokens: 200, inputTokens: 50, cacheRead: 5000, cacheWrite: 500 }),
      makeTurn('opus-4-6', 0.15, { outputTokens: 300, inputTokens: 80, cacheRead: 6000, cacheWrite: 600 }),
      makeTurn('opus-4-7', 0.25, { outputTokens: 800, inputTokens: 100, cacheRead: 7000, cacheWrite: 700 }),
    ])
    const stats = aggregateModelStats([project])
    const m6 = stats.find(s => s.model === 'opus-4-6')!
    const m7 = stats.find(s => s.model === 'opus-4-7')!

    expect(m6.calls).toBe(2)
    expect(m6.cost).toBeCloseTo(0.25)
    expect(m6.outputTokens).toBe(500)
    expect(m7.calls).toBe(1)
    expect(m7.cost).toBeCloseTo(0.25)
    expect(m7.outputTokens).toBe(800)
  })

  it('attributes turn-level metrics to the primary model', () => {
    const project = makeProject([
      makeTurn('opus-4-6', 0.10, { hasEdits: true, retries: 0 }),
      makeTurn('opus-4-6', 0.10, { hasEdits: true, retries: 2 }),
      makeTurn('opus-4-7', 0.20, { hasEdits: true, retries: 0 }),
      makeTurn('opus-4-7', 0.20, { hasEdits: false }),
    ])
    const stats = aggregateModelStats([project])
    const m6 = stats.find(s => s.model === 'opus-4-6')!
    const m7 = stats.find(s => s.model === 'opus-4-7')!

    expect(m6.editTurns).toBe(2)
    expect(m6.oneShotTurns).toBe(1)
    expect(m6.retries).toBe(2)
    expect(m7.editTurns).toBe(1)
    expect(m7.oneShotTurns).toBe(1)
    expect(m7.totalTurns).toBe(2)
  })

  it('tracks firstSeen and lastSeen timestamps', () => {
    const project = makeProject([
      makeTurn('opus-4-6', 0.10, { timestamp: '2026-04-10T08:00:00Z' }),
      makeTurn('opus-4-6', 0.10, { timestamp: '2026-04-15T20:00:00Z' }),
    ])
    const stats = aggregateModelStats([project])
    const m = stats.find(s => s.model === 'opus-4-6')!
    expect(m.firstSeen).toBe('2026-04-10T08:00:00Z')
    expect(m.lastSeen).toBe('2026-04-15T20:00:00Z')
  })

  it('filters out <synthetic> model entries', () => {
    const project = makeProject([
      makeTurn('<synthetic>', 0, {}),
      makeTurn('opus-4-6', 0.10, {}),
    ])
    const stats = aggregateModelStats([project])
    expect(stats.find(s => s.model === '<synthetic>')).toBeUndefined()
    expect(stats).toHaveLength(1)
  })

  it('returns empty array for no projects', () => {
    expect(aggregateModelStats([])).toEqual([])
  })

  it('sorts by cost descending', () => {
    const project = makeProject([
      makeTurn('cheap-model', 0.01),
      makeTurn('expensive-model', 5.00),
    ])
    const stats = aggregateModelStats([project])
    expect(stats[0].model).toBe('expensive-model')
    expect(stats[1].model).toBe('cheap-model')
  })
})

function makeStats(overrides: Partial<ModelStats> = {}): ModelStats {
  return {
    model: 'test-model',
    calls: 100,
    cost: 10,
    outputTokens: 50000,
    inputTokens: 10000,
    cacheReadTokens: 20000,
    cacheWriteTokens: 5000,
    totalTurns: 200,
    editTurns: 80,
    oneShotTurns: 60,
    retries: 20,
    selfCorrections: 10,
    firstSeen: '2026-04-01T00:00:00Z',
    lastSeen: '2026-04-15T00:00:00Z',
    ...overrides,
  }
}

describe('computeComparison', () => {
  it('computes normalized metrics and picks winners correctly', () => {
    const a = makeStats({ calls: 100, cost: 10, outputTokens: 50000, inputTokens: 10000, cacheReadTokens: 20000, cacheWriteTokens: 5000, editTurns: 80, oneShotTurns: 60, retries: 20, selfCorrections: 10, totalTurns: 200 })
    const b = makeStats({ calls: 100, cost: 8, outputTokens: 40000, inputTokens: 10000, cacheReadTokens: 20000, cacheWriteTokens: 5000, editTurns: 80, oneShotTurns: 60, retries: 20, selfCorrections: 10, totalTurns: 200 })
    const rows = computeComparison(a, b)

    const costRow = rows.find(r => r.label === 'Cost / call')!
    expect(costRow.valueA).toBeCloseTo(0.1)
    expect(costRow.valueB).toBeCloseTo(0.08)
    expect(costRow.winner).toBe('b')

    const outputRow = rows.find(r => r.label === 'Output tok / call')!
    expect(outputRow.valueA).toBe(500)
    expect(outputRow.valueB).toBe(400)
    expect(outputRow.winner).toBe('b')
  })

  it('returns null values for one-shot rate and retry rate when editTurns is zero', () => {
    const a = makeStats({ editTurns: 0, oneShotTurns: 0, retries: 0 })
    const b = makeStats({ editTurns: 80, oneShotTurns: 60, retries: 20 })
    const rows = computeComparison(a, b)

    const oneShotRow = rows.find(r => r.label === 'One-shot rate')!
    expect(oneShotRow.valueA).toBeNull()
    expect(oneShotRow.winner).toBe('none')

    const retryRow = rows.find(r => r.label === 'Retry rate')!
    expect(retryRow.valueA).toBeNull()
    expect(retryRow.winner).toBe('none')
  })

  it('returns tie when values are equal', () => {
    const a = makeStats({ calls: 100, cost: 10 })
    const b = makeStats({ calls: 100, cost: 10 })
    const rows = computeComparison(a, b)

    const costRow = rows.find(r => r.label === 'Cost / call')!
    expect(costRow.winner).toBe('tie')
  })

  it('picks higher value as winner for cache hit rate', () => {
    const a = makeStats({ inputTokens: 5000, cacheReadTokens: 30000, cacheWriteTokens: 5000 })
    const b = makeStats({ inputTokens: 10000, cacheReadTokens: 10000, cacheWriteTokens: 5000 })
    const rows = computeComparison(a, b)

    const cacheRow = rows.find(r => r.label === 'Cache hit rate')!
    const totalA = 5000 + 30000 + 5000
    const totalB = 10000 + 10000 + 5000
    expect(cacheRow.valueA).toBeCloseTo(30000 / totalA * 100)
    expect(cacheRow.valueB).toBeCloseTo(10000 / totalB * 100)
    expect(cacheRow.winner).toBe('a')
  })
})
