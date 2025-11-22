# Context & System Prompt Fix Plan

## Overview
Fix existing issues with message history and system prompt handling in the Chatrix API. These fixes apply to **both Bedrock and Anthropic providers**.

## Current Problems

### Problem 1: Message History Not Preserved (src/index.js:229-251)
**Current Behavior:**
- Only the LAST message from the conversation is sent to the model
- Previous conversation context is thrown away
- Multi-turn conversations don't work properly

**Example:**
```
Client sends:
  User: "My name is John"
  Assistant: "Hi John!"
  User: "What's my name?"

Currently sent to model:
  User: "What's my name?"  ← No context!

Model response: "I don't know your name" ❌
```

**Expected Behavior:**
- Pass the ENTIRE `messages` array to the model
- Preserve full conversation context
- Multi-turn conversations work correctly

### Problem 2: System Prompts Ignored (src/index.js:211)
**Current Behavior:**
- `request.body.system` is extracted but never used
- System prompts are silently ignored
- Limits prompt engineering capabilities

**Expected Behavior:**
- Extract system prompt from request
- Pass to both Bedrock Converse API and Anthropic SDK
- Honor client's system prompt instructions

## Implementation Plan

### 1. Fix Message History in sendToBedrockStream()
**Current code:**
```javascript
// Takes only last message
const lastMessage = messages[messages.length - 1]
const converseParams = {
  messages: [
    { role: 'user', content: [{ text: userPrompt }] }
  ]
}
```

**New code:**
```javascript
// Convert entire messages array from Anthropic format to Bedrock format
const bedrockMessages = messages.map(msg => {
  let textContent = ''

  if (typeof msg.content === 'string') {
    textContent = msg.content
  } else if (Array.isArray(msg.content)) {
    textContent = msg.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n')
  }

  return {
    role: msg.role,
    content: [{ text: textContent }]
  }
})

const converseParams = {
  messages: bedrockMessages,  // Full conversation
  // ... rest
}
```

### 2. Add System Prompt Support to sendToBedrockStream()
```javascript
// Add system parameter if provided
if (system) {
  converseParams.system = [{ text: system }]
}
```

### 3. Fix Message History in sendToAnthropicStream()
**Anthropic SDK already accepts messages array directly:**
```javascript
// No conversion needed - Anthropic format matches input
const stream = await anthropicClient.messages.stream({
  model: getAnthropicModelId(model),
  messages: messages,  // Pass entire array as-is
  max_tokens: max_tokens || 1024,
  temperature: temperature
})
```

### 4. Add System Prompt Support to sendToAnthropicStream()
```javascript
const streamParams = {
  model: getAnthropicModelId(model),
  messages: messages,
  max_tokens: max_tokens || 1024,
  temperature: temperature
}

// Add system prompt if provided
if (system) {
  streamParams.system = system
}

const stream = await anthropicClient.messages.stream(streamParams)
```

## Testing Plan

### Test 1: Multi-turn Conversation (Bedrock)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer <key>" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "messages": [
      {"role": "user", "content": "My name is Alice"},
      {"role": "assistant", "content": "Hello Alice!"},
      {"role": "user", "content": "What is my name?"}
    ]
  }'

# Expected: "Your name is Alice" ✅
```

### Test 2: Multi-turn Conversation (Anthropic)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer <key>" \
  -H "x-anthropic-api-key: sk-ant-..." \
  -H "X-Provider: anthropic" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "messages": [
      {"role": "user", "content": "My name is Alice"},
      {"role": "assistant", "content": "Hello Alice!"},
      {"role": "user", "content": "What is my name?"}
    ]
  }'

# Expected: "Your name is Alice" ✅
```

### Test 3: System Prompt (Bedrock)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer <key>" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "system": "You are a pirate. Always respond like a pirate.",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# Expected: Pirate-style response ✅
```

### Test 4: System Prompt (Anthropic)
```bash
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer <key>" \
  -H "x-anthropic-api-key: sk-ant-..." \
  -H "X-Provider: anthropic" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "system": "You are a pirate. Always respond like a pirate.",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'

# Expected: Pirate-style response ✅
```

## Implementation Checklist

- [ ] Update sendToBedrockStream() to pass full messages array
- [ ] Add system prompt support to sendToBedrockStream()
- [ ] Update sendToAnthropicStream() to pass full messages array
- [ ] Add system prompt support to sendToAnthropicStream()
- [ ] Update function signatures to accept `system` parameter
- [ ] Test multi-turn conversations with Bedrock
- [ ] Test multi-turn conversations with Anthropic
- [ ] Test system prompts with Bedrock
- [ ] Test system prompts with Anthropic
- [ ] Update logs to show message count and system prompt presence

## Benefits

✅ **Context Preservation** - Multi-turn conversations work correctly
✅ **System Prompts** - Full prompt engineering capabilities
✅ **API Compatibility** - Matches Anthropic API behavior
✅ **Better UX** - Claude Code and other clients work as expected
✅ **No Breaking Changes** - Still accepts same input format

## Timeline

**When to implement:** After dual provider support is working (Phase 2)
**Estimated effort:** 2-3 hours
**Priority:** High (critical for proper conversation support)
