# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chatrix is an Anthropic API-compatible proxy for AWS Bedrock models. It runs as a containerized Lambda function using AWS Lambda Web Adapter, making it a drop-in replacement for Claude API clients.

**Tech Stack**: Node.js 18+ (ES modules), pnpm, Fastify, AWS Bedrock/Lambda, OpenTofu, Docker

## Essential Commands

```bash
# Development
pnpm install              # ALWAYS use pnpm, not npm
pnpm start               # Runs on http://localhost:3000

# Infrastructure (OpenTofu)
tofu init && tofu fmt && tofu validate
tofu plan                # Preview changes
tofu apply               # Deploy (requires approval)

# Container
docker build -t chatrix:latest .
docker buildx build --platform linux/arm64 -t chatrix:latest .  # For Lambda
```

**Test with Claude Code**:

```bash
export ANTHROPIC_BASE_URL=http://localhost:3000
export ANTHROPIC_AUTH_TOKEN="some-api-key"
```

## Architecture

**src/index.js** - Fastify server (port 3000) with endpoints:
- `POST /v1/messages` - Anthropic API compatible (uses Bedrock ConverseStreamCommand)
- `POST /v1/messages/count_tokens` - Token estimation
- `GET /health` - Health check for Lambda Web Adapter
- Bearer token auth via Secrets Manager (cached after first fetch)

**src/modules/foundation-models.js** - Maps model names to Bedrock model IDs (us.anthropic.* cross-region)

**Infrastructure** (main.tf, github-actions.tf):
- Lambda (ARM64 container) + ECR + IAM + Function URL with CORS
- GitHub Actions → ECR → Lambda (OIDC auth, triggered on release/manual)
- Secrets Manager for API keys, CloudWatch for logs (7-day retention)

## Critical Model Compatibility Notes

### Claude 4.5+ Parameter Restrictions

Claude Sonnet 4.5, Haiku 4.5, Sonnet 4, and Opus 4.1 support EITHER `temperature` OR `topP`, but NOT both simultaneously. The code handles this in src/index.js:255-271:

```javascript
const claude45Models = [
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-20250514',
  'claude-opus-4-1-20250805'
]
const isClaude45Plus = claude45Models.includes(model)

const inferenceConfig = {
  maxTokens: max_tokens || 1024,
  temperature: 0.3
}

// Only add topP for older models
if (!isClaude45Plus) {
  inferenceConfig.topP = 0.3
}
```

When adding new Claude 4.5+ models, add them to the `claude45Models` array.

### Bedrock API Version

The codebase currently uses the **Converse API** (`ConverseStreamCommand`), which provides:

- Unified interface across all Bedrock models
- Native token counting (no approximation needed)
- Simplified payload structure
- Better streaming support

See docs/Migration.md for details on the migration from InvokeModelWithResponseStream.

## Authentication & Configuration

**Auth**: Bearer tokens from Secrets Manager (default: `prod/chatrix/api-key`, override with env `SecretName`). Secret format: `{"api_key": "value"}`. Cached after first fetch.

**Key Environment Variables**:
- `SecretName` - Secrets Manager secret name
- `PORT` - Server port (default: 3000)
- `AWS_LWA_*` - Lambda Web Adapter config (set in Dockerfile)

**Terraform Variables**: See variables.tf for lambda_timeout, lambda_memory, log_retention_days, etc.

## Cost Tracking

Pricing defined in src/index.js:151-168 (per 1K tokens USD):
- Haiku 3.5: $0.0008/$0.004 (input/output)
- Sonnet 3.7/4: $0.003/$0.015
- DeepSeek R1: $0.0014/$0.0028

## Adding New Models

1. Add model ID mapping in src/modules/foundation-models.js: `case 'name': return 'us.provider.id-v1:0'`
2. Add pricing in src/index.js BEDROCK_PRICING: `'name': { input: 0.00X, output: 0.00Y }`
3. If Claude 4.5+, add to `claude45Models` array in src/index.js:255-260
4. Ensure IAM permissions in main.tf allow bedrock:InvokeModel

## Additional Notes

**Logging**: AWS Lambda Powertools Logger (INFO level, structured JSON for CloudWatch)

**Docs**: See docs/Migration.md (Converse API details), docs/Important-docs.md (Bedrock references), docs/TODO.md
