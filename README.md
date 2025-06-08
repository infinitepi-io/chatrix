# Chatrix - OpenAI-Compatible AWS Bedrock API

Chatrix is an OpenAI-compatible API server that provides access to AWS Bedrock foundation models through familiar OpenAI endpoints.

## Features

- 🔌 **OpenAI-Compatible**: Drop-in replacement for OpenAI API clients
- 🏗️ **AWS Bedrock Integration**: Access to Claude Sonnet 4, Claude Sonnet 3, and DeepSeek R1 models
- 💰 **Cost-Controlled**: Built-in cost optimization with parameter limits
- 🚀 **Streaming Support**: Real-time response streaming
- ⚡ **Fastify-Based**: High-performance server built with Fastify

## Quick Start

### Prerequisites
- Node.js 18+
- AWS account with Bedrock access
- AWS credentials configured

### Setup AWS Credentials
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-west-2
```

### Start Server
```bash
npm start
```
Server runs on `http://localhost:3000`

## API Endpoints

### GET /v1/models
Lists available models.

### POST /v1/chat/completions
Creates a chat completion with cost controls.

## Available Models

| Model ID | Provider | Bedrock ID |
|----------|----------|------------|
| `claude-sonnet-4` | Anthropic | `us.anthropic.claude-sonnet-4-20250514-v1:0` |
| `claude-sonnet-3` | Anthropic | `us.anthropic.claude-3-7-sonnet-20250219-v1:0` |
| `deepseek` | DeepSeek | `us.deepseek.r1-v1:0` |

## Parameters & Cost Control

### Supported Parameters

| Parameter | User Control | Default | Limit | Description |
|-----------|--------------|---------|-------|-------------|
| `max_tokens` | ✅ Limited | 512 | **Max: 1024** | Maximum tokens in response |
| `temperature` | ❌ Fixed | 0.3 | 0.3 | Controls randomness (0.0-1.0) |
| `top_p` | ❌ Fixed | 0.3 | 0.3 | Controls diversity (0.0-1.0) |
| `stream` | ✅ Full | false | - | Enable streaming responses |

### Parameter Explanations

#### max_tokens
- **What it does**: Controls the maximum length of the model's response
- **Cost impact**: 🔴 **HIGH** - Directly affects billing (more tokens = higher cost)
- **Range**: 1-1024 (capped for cost control)
- **Default**: 512 tokens (~400 words)

#### temperature
- **What it does**: Controls creativity/randomness in responses
- **Cost impact**: 🟡 **MEDIUM** - Higher values may generate longer responses
- **Range**: 0.0 (deterministic) to 1.0 (very creative)
- **Fixed at**: 0.3 (balanced for quality and cost)

#### top_p
- **What it does**: Controls diversity by limiting token selection to top probability mass
- **Cost impact**: 🟢 **LOW** - Minimal impact on response length
- **Range**: 0.0 to 1.0
- **Fixed at**: 0.3 (focused, coherent responses)

## Client Integration

### Using with Jan App
1. **Base URL**: `http://localhost:3000`
2. **API Key**: Any string (e.g., "dummy-key")
3. **Models**: Will auto-populate from `/v1/models`


## Claude Models 
```
anthropic.claude-sonnet-4-20250514-v1:0
arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0
```

## InvokeModelCommand

InvokeModelCommand
Returns the complete response in a single chunk
Waits for the entire generation to complete before returning
Better for short, one-off responses
Simpler to implement and handle
Uses more memory as it holds the entire response
## InvokeModelWithResponseStreamCommand
Returns the response in real-time as chunks/tokens
Starts returning data as soon as the model begins generating
Ideal for:
Long-form content generation
Interactive chat interfaces
Progress indicators
Real-time display of responses
More efficient memory usage
Lower latency for first-token response
Requires handling streaming data and state management
Think of it like:

InvokeModelCommand = Waiting for a complete letter in the mail
InvokeModelWithResponseStreamCommand = Getting words in real-time during a phone conversation
The streaming version is particularly useful when you want to:

Show typing-like effects
Handle very long responses
Provide immediate feedback to users
Implement cancellation mid-generation
Build interactive applications
The trade-off is increased complexity in handling the streaming response and maintaining state.

https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-configure-reasoning.html
https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-text-completion.html

## Docs
https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/
https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/command/InvokeModelCommand/
https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock_code_examples.html
https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan.html
https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-configure-reasoning.html
https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-text-completion.html
https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-deepseek.html
https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-bedrock-runtime/
https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock-runtime_code_examples.html
