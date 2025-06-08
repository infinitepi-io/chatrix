import Fastify from 'fastify';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime"
import { getModelId, foundationModelsPayload } from "./modules/foundation-models.js"
import { Logger } from '@aws-lambda-powertools/logger';
const logger = new Logger({ serviceName: 'chatrix', level: 'INFO' });

const fastify = Fastify({ logger: true });
const AWS_REGION = "us-west-2";
const client = new BedrockRuntimeClient({ region: AWS_REGION });

// v1/models endpoint - OpenAI compatible
fastify.get('/v1/models', async () => {
  const models = [
    {
      id: "claude-sonnet-4",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "anthropic"
    },
    {
      id: "claude-sonnet-3",
      object: "model", 
      created: Math.floor(Date.now() / 1000),
      owned_by: "anthropic"
    },
    {
      id: "deepseek",
      object: "model",
      created: Math.floor(Date.now() / 1000),
      owned_by: "deepseek"
    }
  ];

  return {
    object: "list",
    data: models
  };
});

// v1/chat/completions endpoint - OpenAI compatible
fastify.post('/v1/chat/completions', async (request, reply) => {
  const requestId = `req-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    const { model, messages } = request.body;
    
    // Cost-controlled parameters
    const max_tokens = Math.min(request.body.max_tokens || 512, 1024); // Cap at 1024 for cost control
    const temperature = 0.3; // Fixed for optimal cost/quality balance
    const top_p = 0.3; // Fixed for consistent performance
    
    logger.info('Chat request received', {
      requestId,
      model,
      clientIP: request.ip
    });
    
    if (!model || !messages) {
      return reply.code(400).type('application/json').send({
        error: {
          message: "Missing required parameters: model and messages",
          type: "invalid_request_error"
        }
      });
    }

    // Extract user prompt from messages
    const userPrompt = messages[messages.length - 1]?.content || "";
    const modelId = getModelId(model);
    const payload = foundationModelsPayload(userPrompt, model, max_tokens, temperature, top_p)

    // Always streaming response
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    const response = await client.send(
      new InvokeModelWithResponseStreamCommand({
        contentType: "application/json",
        body: JSON.stringify(payload),
        modelId: modelId,
      })
    );

    let fullResponse = "";
    let chunkCount = 0;
    
    for await (const chunk of response.body) {
      chunkCount++;
      if (chunk.chunk?.bytes) {
        const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
        let content = "";

        if (model === "deepseek") {
          if (chunkData.choices && chunkData.choices[0]?.text) {
            content = chunkData.choices[0].text;
          }
        } else {
          if (chunkData.type === "content_block_delta" && chunkData.delta?.text) {
            content = chunkData.delta.text;
          }
        }

        if (content) {
          fullResponse += content;
          const streamChunk = {
            id: "chatcmpl-" + Date.now(),
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: { content: content },
              finish_reason: null
            }]
          };
          reply.raw.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
        }
      }
    }

    // Send final chunk
    const finalChunk = {
      id: "chatcmpl-" + Date.now(),
      object: "chat.completion.chunk", 
      created: Math.floor(Date.now() / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: "stop"
      }]
    };
    reply.raw.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    reply.raw.write(`data: [DONE]\n\n`);
    reply.raw.end();
    
    // Calculate final metrics for cost tracking
    const promptTokens = Math.ceil(userPrompt.length / 4);
    const completionTokens = Math.ceil(fullResponse.length / 4);
    const totalTokens = promptTokens + completionTokens;
    const duration = Date.now() - startTime;
    
    // Single comprehensive log for cost calculations
    logger.info('Chat request completed', {
      requestId,
      model,
      modelId,
      // Token usage (for cost calculation)
      tokensReceived: promptTokens,
      tokensSent: completionTokens, 
      totalTokens,
      // Request details
      maxTokensRequested: request.body.max_tokens,
      maxTokensCapped: max_tokens,
      messageCount: messages?.length,
      // Performance metrics
      responseLength: fullResponse.length,
      chunksProcessed: chunkCount,
      durationMs: duration,
      tokensPerSecond: Math.round((totalTokens / duration) * 1000),
      // Client info
      clientIP: request.ip
    });
    
    return reply;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Chat request failed', {
      requestId,
      model: request.body?.model,
      error: error.message,
      durationMs: duration,
      clientIP: request.ip
    });
    
    fastify.log.error("Error in chat completion:", error);
    return reply.code(500).type('application/json').send({
      error: {
        message: "Internal server error",
        type: "internal_server_error"
      }
    });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Chatrix OpenAI-compatible server running on port 3000');
    console.log('Available endpoints:');
    console.log('  GET  /v1/models');
    console.log('  POST /v1/chat/completions');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();