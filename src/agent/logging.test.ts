import { AIMessage } from '@langchain/core/messages'
import { describe, expect, it, vi } from 'vitest'
import { log } from '../logging.js'
import { PinoLangChainHandler } from './logging.js'

vi.mock('../logging.js', () => ({
	log: { debug: vi.fn(), error: vi.fn() }
}))

describe('PinoLangChainHandler', () => {
	it('logs reasoning summaries with the chat and run without logging other output', () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)
		const message = new AIMessage({
			content: [
				{
					type: 'reasoning',
					reasoning: 'Consulto la herramienta antes de responder.'
				},
				{ type: 'reasoning', reasoning: 'Compruebo el resultado.' },
				{ type: 'text', text: 'Respuesta privada' }
			],
			additional_kwargs: { reasoning: { encrypted_content: 'encrypted' } }
		})

		const generations = [[{ text: 'Respuesta privada', message }]]

		handler.handleLLMEnd({ generations }, 'run-1')

		expect(log.debug).toHaveBeenCalledTimes(3)
		expect(log.debug).toHaveBeenNthCalledWith(
			1,
			{
				chatId: 123,
				runId: 'run-1',
				reasoning: 'Consulto la herramienta antes de responder.'
			},
			'LangChain model reasoning'
		)
		expect(log.debug).toHaveBeenNthCalledWith(
			2,
			{
				chatId: 123,
				runId: 'run-1',
				reasoning: 'Compruebo el resultado.'
			},
			'LangChain model reasoning'
		)
		expect(log.debug).toHaveBeenNthCalledWith(
			3,
			{
				chatId: 123,
				runId: 'run-1'
			},
			'LangChain model finished'
		)
	})

	it('finishes normally when reasoning is absent, empty or malformed', () => {
		vi.clearAllMocks()
		const handler = new PinoLangChainHandler(123)

		const generations = [
			[
				{ text: 'Plain generation' },
				{
					text: 'Plain message',
					message: new AIMessage('Plain message')
				},
				{
					text: '',
					message: {
						content: [
							null,
							{ type: 'reasoning', reasoning: 42 },
							{ type: 'reasoning', reasoning: '   ' },
							{ type: 'text', reasoning: 'Not a reasoning block' }
						]
					}
				}
			]
		]

		handler.handleLLMEnd({ generations }, 'run-2')

		expect(log.debug).toHaveBeenCalledExactlyOnceWith(
			{
				chatId: 123,
				runId: 'run-2'
			},
			'LangChain model finished'
		)
	})
})
