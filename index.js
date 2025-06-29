import Fastify from 'fastify'
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand
} from '@aws-sdk/client-bedrock-runtime'
import {
  SecretsManagerClient,
  GetSecretValueCommand
} from '@aws-sdk/client-secrets-manager'
import { getModelId, foundationModelsPayload } from './modules/foundation-models.js'
import { Logger } from '@aws-lambda-powertools/logger'

const logger = new Logger({ serviceName: 'chatrix', level: 'INFO' })
const fastify = Fastify({ logger: true })

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() }
})

const AWS_REGION = 'us-west-2'
const client = new BedrockRuntimeClient({ region: AWS_REGION })
const secretsClient = new SecretsManagerClient({ region: AWS_REGION })

// Cache for API key
let validApiKey = null
const SecretName = process.env.SecretName || 'chatrix/api-key'

// Function to get API key from Secrets Manager
const getValidApiKey = async () => {
  if (validApiKey) {
    return validApiKey // Return cached value
  }

  try {
    logger.info('Fetching API key from Secrets Manager', { secretName: SecretName })
    const response = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: SecretName })
    )
    
    const secret = JSON.parse(response.SecretString)
    validApiKey = secret.api_key
    logger.info('API key loaded successfully')
    return validApiKey
  } catch (error) {
    logger.error('Failed to fetch API key from Secrets Manager', { error: error.message })
    throw new Error('Authentication configuration error')
  }
}

// Validate bearer token
const validateApiKey = async (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix
  const validKey = await getValidApiKey()
  
  return token === validKey
}

// AWS Bedrock pricing per 1K tokens - in USD
const BEDROCK_PRICING = {
  'claude-3-5-haiku-20241022': {
    input: 0.0008, // $0.8 per 1M = $0.0008 per 1K input tokens
    output: 0.004 // $4 per 1M = $0.004 per 1K output tokens
  },
  'claude-3-7-sonnet': {
    input: 0.003, // $3 per 1M = $0.003 per 1K input tokens
    output: 0.015 // $15 per 1M = $0.015 per 1K output tokens
  },
  'claude-sonnet-4': {
    input: 0.003, // $3 per 1M = $0.003 per 1K input tokens
    output: 0.015 // $15 per 1M = $0.015 per 1K output tokens
  }
}

// Calculate cost based on token usage in USD
const calculateCost = (model, inputTokens, outputTokens) => {
  const pricing = BEDROCK_PRICING[model] || BEDROCK_PRICING['claude-3-5-haiku-20241022'] // Default to Haiku (cheapest)

  const inputCostUSD = (inputTokens / 1000) * pricing.input
  const outputCostUSD = (outputTokens / 1000) * pricing.output
  const totalCostUSD = inputCostUSD + outputCostUSD

  return {
    input_cost: parseFloat(inputCostUSD.toFixed(6)),
    output_cost: parseFloat(outputCostUSD.toFixed(6)),
    total_cost: parseFloat(totalCostUSD.toFixed(6)),
    currency: 'USD'
  }
}

// Anthropic API compatible endpoint for Claude Code
fastify.post('/v1/messages', async (request, reply) => {
  const requestId = `req-${Date.now()}`
  const startTime = Date.now()

  try {
    // Validate API key
    const authHeader = request.headers.authorization
    const isValidApiKey = await validateApiKey(authHeader)
    
    if (!isValidApiKey) {
      logger.warn('Invalid or missing API key', { 
        requestId,
        clientIP: request.ip,
        hasAuth: !!authHeader
      })
      return reply.code(401).type('application/json').send({
        type: 'error',
        error: {
          message: 'Invalid API key',
          type: 'authentication_error'
        }
      })
    }

    const { model, messages, max_tokens, stream } = request.body
    logger.info('Anthropic API request received', {
      requestId,
      model,
      clientIP: request.ip
    })

    if (!model || !messages) {
      return reply.code(400).type('application/json').send({
        type: 'error',
        error: {
          message: 'Missing required parameters: model and messages',
          type: 'invalid_request_error'
        }
      })
    }

    // Extract user prompt from messages
    let userPrompt = ''
    try {
      const lastMessage = messages[messages.length - 1]
      userPrompt = lastMessage?.content || ''

      // Handle different content formats
      if (Array.isArray(userPrompt)) {
        userPrompt = userPrompt.map(item => {
          if (item && item.type === 'text' && typeof item.text === 'string') {
            return item.text
          }
          return ''
        }).filter(text => text.length > 0).join('\n')
      }

      if (typeof userPrompt !== 'string') {
        userPrompt = String(userPrompt || '')
      }
    } catch (error) {
      console.error('Error processing userPrompt:', error)
      userPrompt = ''
    }

    const modelId = getModelId(model)
    const payload = foundationModelsPayload(userPrompt, model, max_tokens || 1024, 0.3, 0.3)

    const response = await client.send(
      new InvokeModelWithResponseStreamCommand({
        contentType: 'application/json',
        body: JSON.stringify(payload),
        modelId
      })
    )

    let fullResponse = ''

    // Process all chunks to get complete response
    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes))
        let content = ''
        if (chunkData.type === 'content_block_delta' && chunkData.delta?.text) {
          content = chunkData.delta.text
        }

        if (content) {
          fullResponse += content
        }
      }
    }

    // Calculate token usage and cost
    const inputTokens = Math.ceil(userPrompt.length / 4)
    const outputTokens = Math.ceil(fullResponse.length / 4)
    const cost = calculateCost(model, inputTokens, outputTokens)

    // Return Anthropic API format
    const anthropicResponse = {
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: fullResponse
        }
      ],
      model,
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost
      }
    }

    const duration = Date.now() - startTime
    logger.info('Anthropic API request completed', {
      requestId,
      model,
      responseLength: fullResponse.length,
      durationMs: duration,
      clientIP: request.ip,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost
      }
    })

    return anthropicResponse
  } catch (error) {
    const duration = Date.now() - startTime

    logger.error('Anthropic API request failed', {
      requestId,
      model: request.body?.model,
      error: error.message,
      durationMs: duration,
      clientIP: request.ip
    })

    fastify.log.error('Error in Anthropic API:', error)
    return reply.code(500).type('application/json').send({
      type: 'error',
      error: {
        message: 'Internal server error',
        type: 'internal_server_error'
      }
    })
  }
})

// Start the server for Lambda Web Adapter
const start = async () => {
  try {
    const port = process.env.PORT || 3000
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`Chatrix server running on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
