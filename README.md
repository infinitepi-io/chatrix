# Chatrix - Claude-Compatible AWS Bedrock API

Chatrix is a Claude-compatible API server that provides access to AWS Bedrock foundation models through familiar Claude endpoints.

## Features

- 🔌 **Claude-Compatible**: Drop-in replacement for Claude API clients
- 🏗️ **AWS Bedrock Integration**: Only supports claude models. 
- 💰 **Cost-Controlled**: Built-in cost optimization with parameter limits
- 🚀 **Streaming Support**: Real-time response streaming
- ⚡ **Fastify-Based**: High-performance server built with Fastify
- 💱 **INR Support**: Cost tracking in Indian Rupees

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

### Install Dependencies
```bash
pnpm install
```

### Start Server
```bash
pnpm start
```
Server runs on `http://localhost:3000`

## Available Endpoints

### GET /v1/models
Lists available foundation models

### POST /v1/chat/completions

### Claude Code setup.
Setup below variable:
```bash
export ANTHROPIC_BASE_URL=http://localhost:3000
export ANTHROPIC_AUTH_TOKEN="some-api-key"
```
### Docs:
- https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- https://docs.anthropic.com/en/docs/claude-code/memory
- https://docs.anthropic.com/en/docs/claude-code/costs

## Environment Variables

- `AWS_REGION`: AWS region (default: us-west-2)
- `SHOW_COST_INFO`: Show cost information (default: true)
- `PORT`: Server port (default: 3000)

## Environment Setup

run .export-claude script to export the variables.

These variables configure:
- Default model selection
- Fast/small model option
- API base URL
- Authentication token

## Supported Models

### Anthropic Models
- `claude-sonnet-4` (anthropic.claude-3-sonnet-20240229-v1:0)
  - Input: $0.003/1K tokens
  - Output: $0.015/1K tokens

- `claude-sonnet-3` (anthropic.claude-3-sonnet-20240229-v1:0)
  - Input: $0.003/1K tokens
  - Output: $0.015/1K tokens

### Model Features
- Max tokens: 1024 per request
- Temperature: 0.3 (optimized for code)
- Top-p: 0.3 (focused responses)
- Streaming support enabled

### Default Model
If no model is specified, the system defaults to `claude-sonnet-3`.

## Cost Control

Built-in cost control features:
- Token limits
- Temperature controls
- Usage tracking in INR
- Real-time exchange rate updates

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

## InvokeModelCommand = Waiting for a complete letter in the mail
## InvokeModelWithResponseStreamCommand = Getting words in real-time during a phone conversation
The streaming version is particularly useful when you want to:

Show typing-like effects
Handle very long responses
Provide immediate feedback to users
Implement cancellation mid-generation
Build interactive applications
The trade-off is increased complexity in handling the streaming response and maintaining state.

- https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-configure-reasoning.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-text-completion.html

## Docs
- https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/
- https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/command/InvokeModelCommand/
- https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock_code_examples.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-titan.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-configure-reasoning.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-text-completion.html
- https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-deepseek.html
- https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-client-bedrock-runtime/
- https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_bedrock-runtime_code_examples.html
