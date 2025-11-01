# Migration Plan: Legacy Bedrock API → Converse API

## Benefits
- Unified interface across all Bedrock models
- Native token counting (no approximation)
- Simplified payload structure
- Future-proof API design
- Reduced code complexity (~50 lines saved)

## Changes Required

### 1. Update Imports (index.js:2-5)
```javascript
// BEFORE
import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand
} from '@aws-sdk/client-bedrock-runtime'

// AFTER
import {
  BedrockRuntimeClient,
  ConverseStreamCommand
} from '@aws-sdk/client-bedrock-runtime'
```

### 2. Replace Custom Payload Logic (index.js:161-162)
```javascript
// REMOVE
const modelId = getModelId(model)
const payload = foundationModelsPayload(userPrompt, model, max_tokens || 1024, 0.3, 0.3)

// REPLACE WITH
const converseParams = {
  modelId: getModelId(model), // Keep existing model ID logic
  messages: [
    {
      role: "user",
      content: [{ text: userPrompt }]
    }
  ],
  inferenceConfig: {
    maxTokens: max_tokens || 1024,
    temperature: 0.3,
    topP: 0.3
  }
}
```

### 3. Update API Call (index.js:164-170)
```javascript
// BEFORE
const response = await client.send(
  new InvokeModelWithResponseStreamCommand({
    contentType: 'application/json',
    body: JSON.stringify(payload),
    modelId
  })
)

// AFTER
const response = await client.send(new ConverseStreamCommand(converseParams))
```

### 4. Update Response Processing (index.js:175-187)
```javascript
// BEFORE
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

// AFTER
for await (const chunk of response.stream) {
  if (chunk.contentBlockDelta?.delta?.text) {
    const content = chunk.contentBlockDelta.delta.text
    fullResponse += content
  }
}
```

### 5. Use Native Token Counting (index.js:189-192)
```javascript
// BEFORE (approximation)
const inputTokens = Math.ceil(userPrompt.length / 4)
const outputTokens = Math.ceil(fullResponse.length / 4)

// AFTER (native counting)
const { inputTokens, outputTokens } = response.usage
```

### 6. Clean Up Dependencies
- Remove `import { getModelId, foundationModelsPayload }` from index.js:10
- Keep `getModelId` function but delete `foundationModelsPayload`
- Can eventually remove most of modules/foundation-models.js

## Model ID Compatibility
✅ Current on-demand model IDs work as-is:
- `us.anthropic.claude-sonnet-4-20250514-v1:0`
- `us.anthropic.claude-3-5-haiku-20241022-v1:0`
- `us.anthropic.claude-3-7-sonnet-20250219-v1:0`

## Testing Strategy
1. Test with existing model IDs
2. Verify token counting accuracy
3. Compare response format compatibility
4. Validate streaming behavior
5. Check error handling

## Risk Mitigation
- Keep old code commented during transition
- Test in development environment first
- Monitor CloudWatch logs for any issues
- Rollback plan: revert to InvokeModelWithResponseStream if needed