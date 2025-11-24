# Dual Provider Support Implementation Plan

## Overview
Add support for both AWS Bedrock and Anthropic direct API in the same Lambda function, allowing clients to choose which backend to use.

## Architecture

### Provider Selection Flow
```
Client Request → Lambda
  ├─ Check X-Provider header (optional override)
  ├─ Fall back to DEFAULT_PROVIDER env var
  ├─ Route to appropriate provider:
  │   ├─ bedrock → AWS Bedrock (existing)
  │   └─ anthropic → Anthropic direct API (new)
  └─ Return unified response format
```

### Authentication Flow

**For Bedrock:**
- Client sends: `Authorization: Bearer <internal-api-key>`
- Lambda validates against Secrets Manager
- Lambda uses IAM credentials for Bedrock

**For Anthropic:**
- Client sends: `Authorization: Bearer <internal-api-key>` (validates access)
- Client sends: `ANTHROPIC_AUTH_TOKEN: sk-ant-...` (Anthropic API key)
- Lambda passes Anthropic key to Anthropic SDK

## Implementation Tasks

### 1. Package Dependencies ✅
**File**: `package.json`
**Status**: COMPLETED

Added:
```json
"@anthropic-ai/sdk": "^0.38.0"
```

### 2. Update Model Mapping
**File**: `src/modules/foundation-models.js`

**Current**:
```javascript
export const getModelId = (modelName) => {
  // Returns: us.anthropic.claude-sonnet-4-5-20250929-v1:0
}
```

**New**:
```javascript
export const getBedrockModelId = (modelName) => {
  // Bedrock format: us.anthropic.<model>-v1:0
  // Keep existing logic
}

export const getAnthropicModelId = (modelName) => {
  // Anthropic format: claude-sonnet-4-5-20250929 (no transformation)
  // Validate and return as-is
}
```

### 3. Provider Abstraction Layer
**File**: `src/index.js`

#### 3.1 Add Imports
```javascript
import Anthropic from '@anthropic-ai/sdk'
```

#### 3.2 Initialize Both Clients
```javascript
// Bedrock (existing)
const bedrockClient = new BedrockRuntimeClient({ region: AWS_REGION })

// Anthropic (new)
// Note: API key comes from request headers, not env var
```

#### 3.3 Create Provider Functions

**Function**: `sendToBedrockStream(model, messages, max_tokens, temperature)`
- Extract existing Bedrock streaming logic
- Use ConverseStreamCommand
- Return: `{ fullResponse, inputTokens, outputTokens }`

**Function**: `sendToAnthropicStream(apiKey, model, messages, max_tokens, temperature)`
- Initialize Anthropic client with provided apiKey
- Use Anthropic's streaming API
- Handle event types: `content_block_delta`, `message_delta`, `message_start`
- Return: `{ fullResponse, inputTokens, outputTokens }`

**Function**: `routeRequest(provider, params)`
- Check provider type
- Call appropriate function
- Handle errors consistently

#### 3.4 Update `/v1/messages` Endpoint Logic

```javascript
fastify.post('/v1/messages', async (request, reply) => {
  // 1. Validate internal API key (existing)
  const authHeader = request.headers.authorization
  const isValidApiKey = await validateApiKey(authHeader)
  if (!isValidApiKey) return 401

  // 2. Determine provider
  const requestedProvider = request.headers['x-provider']
  const defaultProvider = process.env.DEFAULT_PROVIDER || 'bedrock'
  const provider = requestedProvider || defaultProvider

  // 3. Get Anthropic API key if needed
  let anthropicApiKey = null
  if (provider === 'anthropic') {
    anthropicApiKey = request.headers['anthropic_auth_token']
    if (!anthropicApiKey) {
      return reply.code(400).send({
        error: 'ANTHROPIC_AUTH_TOKEN header required for Anthropic provider'
      })
    }
  }

  // 4. Route request
  const { model, messages, max_tokens } = request.body

  let result
  try {
    if (provider === 'bedrock') {
      result = await sendToBedrockStream(model, messages, max_tokens, 0.3)
    } else if (provider === 'anthropic') {
      result = await sendToAnthropicStream(
        anthropicApiKey,
        model,
        messages,
        max_tokens,
        0.3
      )
    } else {
      return reply.code(400).send({
        error: `Unknown provider: ${provider}`
      })
    }
  } catch (error) {
    logger.error('Provider request failed', {
      provider,
      model,
      error: error.message
    })
    return reply.code(500).send({ error: error.message })
  }

  // 5. Calculate cost (works for both)
  const cost = calculateCost(model, result.inputTokens, result.outputTokens)

  // 6. Return unified format
  return {
    id: `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: result.fullResponse }],
    model,
    stop_reason: 'end_turn',
    usage: {
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost
    }
  }
})
```

#### 3.5 Update `/v1/messages/count_tokens` Endpoint
- Add provider parameter check
- For Bedrock: existing logic (local estimation)
- For Anthropic: can use same estimation (no API call needed)

### 4. Environment Variables

**Lambda Environment**:
```bash
DEFAULT_PROVIDER=bedrock  # or 'anthropic'
SecretName=prod/your-app/api-key  # for internal API key
```

**Client Environment (Claude Code)**:
```bash
export ANTHROPIC_AUTH_TOKEN=sk-ant-...
export ANTHROPIC_BASE_URL=https://your-chatrix-domain.com
```

**Client Request Headers**:
```
Authorization: Bearer <internal-api-key>
ANTHROPIC_AUTH_TOKEN: sk-ant-...
X-Provider: anthropic  # optional, overrides DEFAULT_PROVIDER
```

### 5. Anthropic Streaming Implementation Details

**Event Types to Handle**:
```javascript
for await (const event of stream) {
  switch (event.type) {
    case 'message_start':
      // Contains initial usage (input tokens)
      inputTokens = event.message.usage.input_tokens
      break

    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        fullResponse += event.delta.text
      }
      break

    case 'message_delta':
      // Contains final usage (output tokens)
      if (event.usage) {
        outputTokens = event.usage.output_tokens
      }
      break

    case 'message_stop':
      // Stream complete
      break
  }
}
```

### 6. Error Handling

**No Automatic Failover** - Return error immediately:
- Bedrock rate limit → Return 429 with Bedrock error
- Anthropic rate limit → Return 429 with Anthropic error
- Invalid model → Return 400
- Invalid API key → Return 401

### 7. Logging

Add provider information to all logs:
```javascript
logger.info('Request received', {
  provider,
  model,
  requestId,
  clientIP
})

logger.info('Request completed', {
  provider,
  model,
  duration,
  inputTokens,
  outputTokens,
  cost
})
```

## Testing Plan

### Local Testing

**Test Bedrock (existing)**:
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer <internal-key>" \
  -H "X-Provider: bedrock" \
  -d '{"model":"claude-3-7-sonnet-20250219","messages":[...]}'
```

**Test Anthropic (new)**:
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer <internal-key>" \
  -H "ANTHROPIC_AUTH_TOKEN: sk-ant-..." \
  -H "X-Provider: anthropic" \
  -d '{"model":"claude-3-7-sonnet-20250219","messages":[...]}'
```

**Test Default Provider**:
```bash
# Without X-Provider header, uses DEFAULT_PROVIDER
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer <internal-key>" \
  -d '{"model":"claude-3-7-sonnet-20250219","messages":[...]}'
```

### Claude Code Integration

**Using Bedrock**:
```bash
export ANTHROPIC_BASE_URL=https://your-chatrix-domain.com
# No ANTHROPIC_AUTH_TOKEN needed for Bedrock
claude -p "test prompt"
```

**Using Anthropic**:
```bash
export ANTHROPIC_BASE_URL=https://your-chatrix-domain.com
export ANTHROPIC_AUTH_TOKEN=sk-ant-...
# Add header via curl or custom client wrapper
```

## Deployment Checklist

- [ ] Update package.json (DONE)
- [ ] Update src/modules/foundation-models.js
- [ ] Refactor src/index.js with provider abstraction
- [ ] Test locally with Docker (both providers)
- [ ] Run pnpm install to update dependencies
- [ ] Build Docker image for ARM64
- [ ] Push to ECR
- [ ] Update Lambda function
- [ ] Set DEFAULT_PROVIDER environment variable
- [ ] Test via CloudFront URL
- [ ] Test with Claude Code CLI

## Benefits

✅ **Flexibility**: Choose provider per request or set default
✅ **No Breaking Changes**: Existing Bedrock clients work as-is
✅ **Cost Optimization**: Use Bedrock for discounts, Anthropic for latest features
✅ **Compliance**: Use Bedrock for AWS-compliant environments
✅ **Feature Access**: Use Anthropic for newest model releases
✅ **Unified Interface**: Same API format regardless of backend

## Trade-offs

⚠️ **Complexity**: More code to maintain
⚠️ **Testing**: Need to test both providers
⚠️ **Authentication**: Clients need to manage Anthropic API key
⚠️ **Model Availability**: Some models only on one provider (e.g., DeepSeek on Bedrock)

## Future Enhancements

- Add automatic provider selection based on model availability
- Add request/response caching layer
- Add provider health checks
- Add metrics/monitoring per provider
- Support for other providers (OpenAI, etc.)