import Fastify from 'fastify';
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime"
import { getModelId, foundationModelsPayload } from "./modules/foundation-models.js"
import { Logger } from '@aws-lambda-powertools/logger';
import axios from 'axios';

const logger = new Logger({ serviceName: 'chatrix', level: 'INFO' });

const fastify = Fastify({ logger: true });
const AWS_REGION = "us-west-2";
const client = new BedrockRuntimeClient({ region: AWS_REGION });

// Check if user wants to show cost information
const SHOW_COST_TO_USER = process.env.SHOW_COST_INFO === 'true' || true; // Default to true

// Dynamic USD to INR exchange rate
let USD_TO_INR = 83.5; // Default fallback rate

// Fetch live exchange rate
const updateExchangeRate = async () => {
  try {
    const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
    USD_TO_INR = response.data.rates.INR;
    console.log(`💱 Exchange rate updated: $1 = ₹${USD_TO_INR.toFixed(2)}`);
  } catch (error) {
    console.warn('⚠️ Failed to fetch exchange rate, using fallback:', USD_TO_INR);
  }
};

// Update exchange rate on startup and every 24 hours
updateExchangeRate();
setInterval(updateExchangeRate, 24 * 60 * 60 * 1000); // 24 hours

// AWS Bedrock pricing per 1K tokens (Your 3 models only) - in USD
const BEDROCK_PRICING = {
  'claude-3-5-haiku-20241022': {
    input: 0.0008,  // $0.8 per 1M = $0.0008 per 1K input tokens
    output: 0.004   // $4 per 1M = $0.004 per 1K output tokens
  },
  'claude-3-7-sonnet': {
    input: 0.003,   // $3 per 1M = $0.003 per 1K input tokens
    output: 0.015   // $15 per 1M = $0.015 per 1K output tokens  
  },
  'claude-sonnet-4': {
    input: 0.003,   // $3 per 1M = $0.003 per 1K input tokens
    output: 0.015   // $15 per 1M = $0.015 per 1K output tokens
  }
};

// Calculate cost based on token usage in INR
const calculateCost = (model, inputTokens, outputTokens) => {
  const pricing = BEDROCK_PRICING[model] || BEDROCK_PRICING['claude-3-5-haiku-20241022']; // Default to Haiku (cheapest)
  
  // Calculate in USD first
  const inputCostUSD = (inputTokens / 1000) * pricing.input;
  const outputCostUSD = (outputTokens / 1000) * pricing.output;
  const totalCostUSD = inputCostUSD + outputCostUSD;
  
  // Convert to INR
  const inputCostINR = inputCostUSD * USD_TO_INR;
  const outputCostINR = outputCostUSD * USD_TO_INR;
  const totalCostINR = totalCostUSD * USD_TO_INR;
  
  return {
    input_cost: parseFloat(inputCostINR.toFixed(6)),
    output_cost: parseFloat(outputCostINR.toFixed(6)),
    total_cost: parseFloat(totalCostINR.toFixed(6)),
    currency: 'INR',
    exchange_rate: USD_TO_INR,
    usd_equivalent: parseFloat(totalCostUSD.toFixed(6))
  };
};

// Anthropic API compatible endpoint for Claude Code
fastify.post('/v1/messages', async (request, reply) => {
  const requestId = `req-${Date.now()}`;
  const startTime = Date.now();
  
  try {
    const { model, messages, max_tokens, stream } = request.body;
    
    logger.info('Anthropic API request received', {
      requestId,
      model,
      clientIP: request.ip
    });
    
    if (!model || !messages) {
      return reply.code(400).type('application/json').send({
        type: "error",
        error: {
          message: "Missing required parameters: model and messages",
          type: "invalid_request_error"
        }
      });
    }

    // Extract user prompt from messages
    let userPrompt = "";
    try {
      const lastMessage = messages[messages.length - 1];
      userPrompt = lastMessage?.content || "";
      
      // Handle different content formats
      if (Array.isArray(userPrompt)) {
        userPrompt = userPrompt.map(item => {
          if (item && item.type === 'text' && typeof item.text === 'string') {
            return item.text;
          }
          return '';
        }).filter(text => text.length > 0).join('\n');
      }
      
      if (typeof userPrompt !== 'string') {
        userPrompt = String(userPrompt || '');
      }
    } catch (error) {
      console.error('Error processing userPrompt:', error);
      userPrompt = '';
    }
    
    const modelId = getModelId(model);
    const payload = foundationModelsPayload(userPrompt, model, max_tokens || 1024, 0.3, 0.3);

    const response = await client.send(
      new InvokeModelWithResponseStreamCommand({
        contentType: "application/json",
        body: JSON.stringify(payload),
        modelId: modelId,
      })
    );

    let fullResponse = "";
    
    // Process all chunks to get complete response
    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const chunkData = JSON.parse(new TextDecoder().decode(chunk.chunk.bytes));
        let content = "";
        if (chunkData.type === "content_block_delta" && chunkData.delta?.text) {
          content = chunkData.delta.text;
        }

        if (content) {
          fullResponse += content;
        }
      }
    }

    // Calculate token usage and cost
    const inputTokens = Math.ceil(userPrompt.length / 4);
    const outputTokens = Math.ceil(fullResponse.length / 4);
    const cost = calculateCost(model, inputTokens, outputTokens);

    // Add cost information to the response text
    const costInfo = `\n\n---\n💰 Cost: ${cost.total_cost.toFixed(6)} (${inputTokens} input + ${outputTokens} output tokens)`;
    const responseWithCost = fullResponse + costInfo;

    // Return Anthropic API format with cost information
    const anthropicResponse = {
      id: `msg_${Date.now()}`,
      type: "message",
      role: "assistant",
      content: [
        {
          type: "text",
          text: responseWithCost
        }
      ],
      model: model,
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
        cost: cost
      }
    };

    const duration = Date.now() - startTime;
    logger.info('Anthropic API request completed', {
      requestId,
      model,
      responseLength: fullResponse.length,
      durationMs: duration,
      clientIP: request.ip,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_cost_inr: cost.total_cost,
        total_cost_usd: cost.usd_equivalent
      }
    });

    return anthropicResponse;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Anthropic API request failed', {
      requestId,
      model: request.body?.model,
      error: error.message,
      durationMs: duration,
      clientIP: request.ip
    });
    
    fastify.log.error("Error in Anthropic API:", error);
    return reply.code(500).type('application/json').send({
      type: "error",
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
    console.log('Chatrix server running on port 3000');
    console.log('Available endpoints:');
    console.log('  POST /v1/messages (Anthropic API format - for Claude Code)');
    console.log('  POST /v1/chat/completions (OpenAI format - with cost tracking)');
    console.log('');
    console.log('💰 Cost tracking enabled with 2025 AWS Bedrock pricing');
    console.log(`📊 Cost display to users: ${SHOW_COST_TO_USER ? 'ENABLED' : 'DISABLED'}`);
    console.log(`💱 Live currency: INR (Current rate: $1 = ₹${USD_TO_INR.toFixed(2)})`);
    console.log('');
    console.log('📋 Your Models Pricing (per 1K tokens):');
    console.log('   🏃 Claude 3.5 Haiku:  ₹0.067 input + ₹0.334 output (fastest, cheapest)');
    console.log('   🧠 Claude 3.7 Sonnet: ₹0.251 input + ₹1.253 output (reasoning mode)');
    console.log('   🚀 Claude Sonnet 4:   ₹0.251 input + ₹1.253 output (most capable)');
    console.log('');
    console.log('🔄 Exchange rate updates automatically every 24 hours');
    console.log('💡 To disable cost display: export SHOW_COST_INFO=false');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();