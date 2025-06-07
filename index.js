import Fastify from 'fastify'
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand
} from '@aws-sdk/client-bedrock-runtime'
import { getModelId, foundationModelsPayload } from './modules/foundation-models.js'

const fastify = Fastify({ logger: true })
const AWS_REGION = 'us-west-2'
const client = new BedrockRuntimeClient({ region: AWS_REGION })

// v1/models endpoint - OpenAI compatible
fastify.get('/v1/models', async () => {
  const models = [
    {
      id: 'claude-sonnet-4',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'anthropic'
    },
    {
      id: 'claude-sonnet-3',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'anthropic'
    },
    {
      id: 'deepseek',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'deepseek'
    }
  ]

  return {
    object: 'list',
    data: models
  }
})

// v1/chat/completions endpoint - OpenAI compatible
fastify.post('/v1/chat/completions', async (request, reply) => {
  try {
    // console.log('Received chat completion request:', request.body)
    const { model, messages, stream = true, max_tokens = 512, temperature = 0.3 } = request.body

    if (!model || !messages) {
      reply.code(400)
      return {
        error: {
          message: 'Missing required parameters: model and messages',
          type: 'invalid_request_error'
        }
      }
    }

    // Extract user prompt from messages
    const userPrompt = messages[messages.length - 1]?.content || ''
    const modelId = getModelId(model)
    const payload = foundationModelsPayload(userPrompt, model).payload

    // Override with request parameters
    if (payload.max_tokens !== undefined) payload.max_tokens = max_tokens
    if (payload.temperature !== undefined) payload.temperature = temperature

    if (stream) {
      // Streaming response
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')

      const response = await client.send(
        new InvokeModelWithResponseStreamCommand({
          contentType: 'application/json',
          body: JSON.stringify(payload),
          modelId
        })
      )

      let fullResponse = ''

      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes))
          let content = ''

          if (model === 'deepseek') {
            if (chunkData.choices && chunkData.choices[0]?.text) {
              content = chunkData.choices[0].text
            }
          } else {
            if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
              content = chunkData.delta.text
            }
          }

          if (content) {
            fullResponse += content
            const streamChunk = {
              id: 'chatcmpl-' + Date.now(),
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [{
                index: 0,
                delta: { content },
                finish_reason: null
              }]
            }
            reply.raw.write(`data: ${JSON.stringify(streamChunk)}\n\n`)
          }
        }
      }

      // Send final chunk
      const finalChunk = {
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      }
      reply.raw.write(`data: ${JSON.stringify(finalChunk)}\n\n`)
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
      return reply
    } else {
      // Non-streaming response
      const response = await client.send(
        new InvokeModelWithResponseStreamCommand({
          contentType: 'application/json',
          body: JSON.stringify(payload),
          modelId
        })
      )

      let fullResponse = ''

      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes))

          if (model === 'deepseek') {
            if (chunkData.choices && chunkData.choices[0]?.text) {
              fullResponse += chunkData.choices[0].text
            }
          } else {
            if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
              fullResponse += chunkData.delta.text
            }
          }
        }
      }

      return {
        id: 'chatcmpl-' + Date.now(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: fullResponse
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: Math.ceil(userPrompt.length / 4),
          completion_tokens: Math.ceil(fullResponse.length / 4),
          total_tokens: Math.ceil((userPrompt.length + fullResponse.length) / 4)
        }
      }
    }
  } catch (error) {
    fastify.log.error('Error in chat completion:', error)
    reply.code(500)
    return {
      error: {
        message: 'Internal server error',
        type: 'internal_server_error'
      }
    }
  }
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' })
    console.log('Chatrix OpenAI-compatible server running on port 3000')
    console.log('Available endpoints:')
    console.log('  GET  /v1/models')
    console.log('  POST /v1/chat/completions')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
