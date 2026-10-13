import { describe, expect, it, vi } from 'vitest'
import { createRuntimeContextSources } from '@/agent/context/sources'
import { collectContextSources, reconcileContext } from '@/agent/context/journal'
import type { SkillMetadata } from '@/skills/skill-types'

const state = vi.hoisted(() => ({ initialized: true, skills: [] as SkillMetadata[] }))
vi.mock('@/skills/skill-manager', () => ({ getSkillManager: () => ({
  initialized: state.initialized, getSkillMetadata: () => state.skills,
}) }))

const input = { baseSystemPrompt: 'fixed', messages: [], mode: 'act' as const, toolContext: { directoryHandle: null } }
const skill = (name: string): SkillMetadata => ({
  id: name, name, version: '1', description: `Description ${name}`, author: 'author',
  category: 'general', tags: ['b', 'a'], source: 'user', enabled: true,
  triggers: { keywords: ['z', 'a'], fileExtensions: ['.ts', '.js'] }, createdAt: 1, updatedAt: 1,
})

describe('skill source uses the generic environment protocol', () => {
  it('normalizes unordered metadata and ignores invisible installation timestamps', async () => {
    state.initialized = true
    state.skills = [skill('a')]
    const source = createRuntimeContextSources(() => input).find(source => source.id === 'skills')!
    const first = reconcileContext([], await collectContextSources([source]), 'fixed')!
    state.skills = [{ ...skill('a'), updatedAt: 100, tags: ['a', 'b'],
      triggers: { keywords: ['a', 'z'], fileExtensions: ['.js', '.ts'] } }]
    expect(reconcileContext([first], await collectContextSources([source]), 'fixed')).toBeUndefined()
    state.skills = [{ ...skill('a'), enabled: false }]
    const disabled = reconcileContext([first], await collectContextSources([source]), 'fixed')!
    expect(disabled.contextCommit!.changes[0].removed).toEqual(['a'])
  })

  it('does not treat an uninitialized skill manager as an empty catalog', async () => {
    state.initialized = false
    const source = createRuntimeContextSources(() => input).find(source => source.id === 'skills')!
    expect(await collectContextSources([source])).toEqual([])
    state.initialized = true
  })
})
