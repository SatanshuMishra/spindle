import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { harness } from './harness'

const PANE_PROPS = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} } as const

test('/spindle opens then closes the pane', async ($, on) => {
  const world = harness(on, null)
  await world.start($)

  const first = await $.command.run({ command: 'spindle', args: '' } as never)
  expect(first).toMatchObject({ text: 'Run pane opened.' })
  expect(world.opened()).toEqual(['spindle-run'])

  const second = await $.command.run({ command: 'spindle', args: '' } as never)
  expect(second).toMatchObject({ text: 'Run pane closed.' })
  expect(world.closed()).toEqual(['spindle-run'])
})

test('empty pane and no band without a run', async ($, on) => {
  const beneath: RenderElement[] = []
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    const drawn = Text({ children: 'another band' })
    beneath.push(drawn)
    return drawn
  })
  const world = harness(on, null)
  await world.start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({ plugin: 'spindle', surface, component: 'Pane', requestId: 'spindle-run', props: PANE_PROPS })
    expect(await pane.find({ type: 'Text', text: 'No pipeline run in this session.' })).toBeDefined()
    await pane.unmount()

    const band = await $.ui.mount({ plugin: 'spindle', surface, component: 'AbovePrompt', props: BAND_PROPS })
    expect(await band.drawn()).toMatchObject(beneath[beneath.length - 1] ?? {})
    expect(await band.find({ type: 'Text', text: 'another band' })).toBeDefined()
    await band.unmount()
  }
})
