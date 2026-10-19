import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { L, NOW, R, SF, build, cleaned, decisionAnchor, endedLane, fix, fixRound2, integrate, otherThread, review, secondRun, ship, spec, split, stateWith, threadOnly, withFile } from './fixtures/runs'
import { harness } from './harness'

const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const

async function status($: Engine): Promise<string[]> {
  const answered = await $.command.run({ command: 'spindle', args: 'status' } as never)
  return String(answered.text ?? '').split('\n')
}

const mspLine = (lines: readonly string[], label: string) => lines.find(line => line.startsWith(`msp ${label} `)) ?? ''

test('run home comes from latest_anchor', async ($, on) => {
  const world = harness(on, split, { now: NOW })
  await world.start($, '/home/owner/work/fireplace')

  const lines = await status($)
  expect(lines).toContain('run rate-limit-api repo field-notes')
  expect(mspLine(lines, 'limiter-core')).not.toBe('')
  expect(world.reads()).toContain('/home/owner/.mitosis/runs/field-notes/rate-limit-api/plan.json')
})

test('no session file shows no run', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: 'another band' })
  })
  const world = harness(on, null, { now: NOW })
  await world.start($)

  expect(await status($)).toEqual(['No pipeline run in this session.'])
  expect(world.reads()).toContain(SF)
  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ plugin: 'spindle', surface, component: 'AbovePrompt', props: BAND_PROPS })
    expect(await band.drawn()).toMatchObject({ type: 'Text', children: ['another band'] })
    await band.unmount()
  }
})

test('decision anchor falls back to the last run home', async ($, on) => {
  const world = harness(on, decisionAnchor, { now: NOW })
  await world.start($)

  const lines = await status($)
  expect(lines).toContain('run rate-limit-api repo api')
  expect(lines).toContain('stage review round 1 finished no')
})

test('thread id alone shows no run', async ($, on) => {
  const world = harness(on, threadOnly, { now: NOW })
  await world.start($)

  expect(await status($)).toEqual(['No pipeline run in this session.'])
})

test("a decision anchor names the thread's newest run home", async ($, on) => {
  const world = harness(on, secondRun, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('run quota-api repo api')
})

test('a run home of another thread is not shown', async ($, on) => {
  const world = harness(on, otherThread, { now: NOW })
  await world.start($)

  expect(await status($)).toEqual(['No pipeline run in this session.'])
})

test('a run home pipeline clean deleted shows no run', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return Text({ children: 'another band' })
  })
  const world = harness(on, cleaned, { now: NOW })
  await world.start($)

  expect(await status($)).toEqual(['No pipeline run in this session.'])
  const band = await $.ui.mount({ plugin: 'spindle', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await band.drawn()).toMatchObject({ type: 'Text', children: ['another band'] })
  await band.unmount()
})

test('a run shown until pipeline clean deletes its home is hidden on the next poll', async ($, on) => {
  const world = harness(on, integrate, { now: NOW })
  await world.start($)
  expect(await status($)).toContain('stage integrate round 0 finished no')

  world.use(cleaned)
  await world.clock.advance(2000)

  expect(await status($)).toEqual(['No pipeline run in this session.'])
})

test('fixture at spec stage reads Spec', async ($, on) => {
  const world = harness(on, spec, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('stage spec round 0 finished no')
})

test('fixture at build stage reads Build', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('stage build round 0 finished no')
})

test('fixture at review round 1 reads Review R1', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('stage review round 1 finished no')
})

test('loop verdict reads Fix', async ($, on) => {
  const world = harness(on, fix, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('stage fix round 1 finished no')
})

test('new round after fix reads Review R2', async ($, on) => {
  const world = harness(on, fix, { now: NOW })
  await world.start($)
  expect(await status($)).toContain('stage fix round 1 finished no')

  world.use(fixRound2)
  await world.clock.advance(2000)

  expect(await status($)).toContain('stage review round 2 finished no')
})

test('pushed MSP reads Ship', async ($, on) => {
  const world = harness(on, ship, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('stage ship round 0 finished no')
})

test('lighthouse folder reads Integrate', async ($, on) => {
  const world = harness(on, integrate, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('stage integrate round 0 finished no')
})

test('building lane shows Building with progress', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  await world.start($)

  expect(mspLine(await status($), 'limiter-core').startsWith('msp limiter-core building 1/2')).toBe(true)
})

test('committed MSP with gate shows proof dots', async ($, on) => {
  const world = harness(on, review, { now: NOW })
  await world.start($)

  expect(mspLine(await status($), 'limiter-core').startsWith('msp limiter-core review 2/2 proof red,green')).toBe(true)
})

test('pull request number shows PR open', async ($, on) => {
  const world = harness(on, ship, { now: NOW })
  await world.start($)

  const line = mspLine(await status($), 'limiter-core')
  expect(line.startsWith('msp limiter-core pr')).toBe(true)
  expect(line).toContain('pr #41')
})

test('blocked lane shows Failed', async ($, on) => {
  const blocked = withFile(
    build,
    `${R}/state.json`,
    stateWith({ '0': endedLane(0, 0, 'ok', 4), '1': endedLane(1, 0, 'blocked', 2) }, {}),
    NOW - 2 * 60_000,
  )
  const world = harness(on, blocked, { now: NOW })
  await world.start($)

  expect(mspLine(await status($), 'limiter-core').startsWith('msp limiter-core failed')).toBe(true)
})

test('verdict file gives a loop round row', async ($, on) => {
  const world = harness(on, fix, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('round 1 limiter-core candidates 7 blockers 2 advisories 1 outcome loop')
})

test('unreadable ledger drops only the candidate count', async ($, on) => {
  const world = harness(on, fix, { now: NOW })
  world.failRead(L, 'EFBIG: file is larger than the 4 MiB read cap')
  await world.start($)

  expect(await status($)).toContain('round 1 limiter-core candidates ? blockers 2 advisories 1 outcome loop')
})

test('state.json of another shape marks MSPs unknown', async ($, on) => {
  const world = harness(on, withFile(build, `${R}/state.json`, '[]', NOW - 2 * 60_000), { now: NOW })
  await world.start($)

  const lines = await status($)
  const msps = lines.filter(line => line.startsWith('msp '))
  expect(msps.length).toBe(3)
  for (const line of msps) expect(line.split(' ')[2]).toBe('unknown')
  expect(lines).toContain('run rate-limit-api repo api')
  expect(lines).toContain('lane unknown')
})

test('verdict that is not JSON makes the stage unknown', async ($, on) => {
  const broken = withFile(fix, '/home/owner/.mitosis/api/rate-limit-api/review/round-1/limiter-core.verdict.json', 'not json', NOW - 30_000)
  const world = harness(on, broken, { now: NOW })
  await world.start($)

  expect(await status($)).toContain('stage unknown round 1 finished no')
})

test('a changed file is read on the next tick', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  await world.start($)
  expect(mspLine(await status($), 'limiter-core')).toContain(' 1/2 ')

  world.use(
    withFile(build, `${R}/state.json`, stateWith({ '0': endedLane(0, 0, 'ok', 4), '1': endedLane(1, 0, 'ok', 1) }, {}), NOW - 60_000),
  )
  await world.clock.advance(2000)

  expect(mspLine(await status($), 'limiter-core')).toContain(' 2/2 ')
  expect(world.reads().filter(path => path === `${R}/plan.json`).length).toBe(1)
})

test('unreadable plan.json makes the stage unknown', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  world.failRead(`${R}/plan.json`, 'EACCES: permission denied')
  await world.start($)

  expect(await status($)).toContain('stage unknown round 0 finished no')
})

test('unreadable verdict makes the stage unknown', async ($, on) => {
  const world = harness(on, fix, { now: NOW })
  world.failRead('/home/owner/.mitosis/api/rate-limit-api/review/round-1/limiter-core.verdict.json', 'EFBIG: file is larger than the 4 MiB read cap')
  await world.start($)

  expect(await status($)).toContain('stage unknown round 1 finished no')
})

test('unreadable state.json marks MSPs unknown', async ($, on) => {
  const world = harness(on, build, { now: NOW })
  world.failRead(`${R}/state.json`, 'EFBIG: file is larger than the 4 MiB read cap')
  await world.start($)

  const msps = (await status($)).filter(line => line.startsWith('msp '))
  expect(msps.length).toBe(3)
  for (const line of msps) expect(line.split(' ')[2]).toBe('unknown')
})
