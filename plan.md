# Chatrix Lambda Deployment Plan: Terraform + SAM

## Overview
Deploy chatrix as an AWS Lambda function using container images, with Terraform for infrastructure provisioning and SAM CLI for local development/testing.

---

## Understanding SAM + Terraform Integration

### Key Concept
This is NOT a deployment integration. SAM and Terraform serve different purposes:

- **SAM CLI**: Development tool for local testing
  - `sam build --hook-name terraform` - Build Lambda locally
  - `sam local invoke --hook-name terraform` - Test function locally
  - `sam local start-api --hook-name terraform` - Run API locally

- **Terraform**: Infrastructure provisioning and deployment
  - `terraform apply` - Deploy to AWS
  - Manages all AWS resources (Lambda, ECR, IAM, Secrets)
  - Handles state management

- **Integration Point**: `sam metadata` resource in Terraform tells SAM CLI how to find and build your Lambda

---

## Current State

### What We Have ✓
- `index.js` - Fastify server with Bedrock integration
- `Dockerfile` - Container config with Lambda Web Adapter
- `package.json` - Dependencies defined
- `modules/foundation-models.js` - Model ID mapping
- `prompts/system-prompt.md` - System prompt (currently not used)

### AWS Services Currently Used
- **Bedrock Runtime** - Claude model inference (ConverseStream API)
- **Secrets Manager** - API key storage (`prod/chatrix/api-key`)
- **CloudWatch** - Logging via Powertools

### Environment Variables
- `SecretName` (default: "prod/chatrix/api-key")
- `PORT` (default: 3000)
- `AWS_REGION` (hardcoded: "us-west-2")

---

## What We Need to Build

### 1. Terraform Configuration Files

#### `terraform/main.tf`
Define core infrastructure:

**ECR Repository**
```hcl
resource "aws_ecr_repository" "chatrix" {
  name                 = "chatrix"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  lifecycle {
    prevent_destroy = true  # Protect production images
  }
}

resource "aws_ecr_lifecycle_policy" "chatrix" {
  repository = aws_ecr_repository.chatrix.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}
```

**Lambda Function (Container-based)**
```hcl
resource "aws_lambda_function" "chatrix" {
  function_name = var.function_name
  role          = aws_iam_role.chatrix_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.chatrix.repository_url}:${var.image_tag}"

  timeout     = 30
  memory_size = 512

  environment {
    variables = {
      SecretName = aws_secretsmanager_secret.chatrix_api_key.name
      AWS_REGION = var.aws_region
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.bedrock_access,
    aws_iam_role_policy_attachment.secrets_access,
    aws_cloudwatch_log_group.chatrix
  ]
}
```

**IAM Role for Lambda**
```hcl
resource "aws_iam_role" "chatrix_lambda" {
  name = "${var.function_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Basic Lambda execution
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.chatrix_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Bedrock access
resource "aws_iam_policy" "bedrock_access" {
  name        = "${var.function_name}-bedrock-access"
  description = "Allow Lambda to call Bedrock models"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ]
      Resource = [
        "arn:aws:bedrock:${var.aws_region}::foundation-model/*"
      ]
    }]
  })
}

resource "aws_iam_role_policy_attachment" "bedrock_access" {
  role       = aws_iam_role.chatrix_lambda.name
  policy_arn = aws_iam_policy.bedrock_access.arn
}

# Secrets Manager access
resource "aws_iam_policy" "secrets_access" {
  name        = "${var.function_name}-secrets-access"
  description = "Allow Lambda to read API key from Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = aws_secretsmanager_secret.chatrix_api_key.arn
    }]
  })
}

resource "aws_iam_role_policy_attachment" "secrets_access" {
  role       = aws_iam_role.chatrix_lambda.name
  policy_arn = aws_iam_policy.secrets_access.arn
}
```

**Secrets Manager Secret**
```hcl
resource "aws_secretsmanager_secret" "chatrix_api_key" {
  name        = var.secret_name
  description = "API key for Chatrix authentication"

  recovery_window_in_days = 7
}

# Note: Secret value must be set manually or via separate secure process
# aws secretsmanager put-secret-value --secret-id prod/chatrix/api-key --secret-string '{"api_key":"your-key-here"}'
```

**CloudWatch Log Group**
```hcl
resource "aws_cloudwatch_log_group" "chatrix" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 7
}
```

**Lambda Function URL (Option 1: Simple)**
```hcl
resource "aws_lambda_function_url" "chatrix" {
  function_name      = aws_lambda_function.chatrix.function_name
  authorization_type = "NONE"  # No auth at Lambda level, handled by app

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    max_age          = 86400
  }
}
```

**SAM Metadata (Optional - for local testing)**
```hcl
resource "null_resource" "sam_metadata_chatrix" {
  triggers = {
    resource_name    = "aws_lambda_function.chatrix"
    resource_type    = "IMAGE_LAMBDA_FUNCTION"
    docker_context   = path.root
    docker_file      = "Dockerfile"
    docker_tag       = var.image_tag
  }
}
```

#### `terraform/variables.tf`
```hcl
variable "function_name" {
  description = "Lambda function name"
  type        = string
  default     = "chatrix"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-west-2"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "secret_name" {
  description = "Secrets Manager secret name for API key"
  type        = string
  default     = "prod/chatrix/api-key"
}
```

#### `terraform/outputs.tf`
```hcl
output "lambda_function_url" {
  description = "Lambda Function URL"
  value       = aws_lambda_function_url.chatrix.function_url
}

output "lambda_function_arn" {
  description = "Lambda Function ARN"
  value       = aws_lambda_function.chatrix.arn
}

output "ecr_repository_url" {
  description = "ECR Repository URL"
  value       = aws_ecr_repository.chatrix.repository_url
}

output "secret_arn" {
  description = "Secrets Manager Secret ARN"
  value       = aws_secretsmanager_secret.chatrix_api_key.arn
}
```

#### `terraform/versions.tf`
```hcl
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Optional: Remote state backend
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "chatrix/terraform.tfstate"
  #   region         = "us-west-2"
  #   dynamodb_table = "terraform-state-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region
}
```

#### `terraform/terraform.tfvars` (Optional)
```hcl
function_name = "chatrix"
aws_region    = "us-west-2"
image_tag     = "latest"
secret_name   = "prod/chatrix/api-key"
```

---

### 2. SAM Configuration (Optional)

#### `samconfig.toml`
```toml
version = 0.1

[default.local_invoke]
hook_name = "terraform"

[default.local_start_api]
hook_name = "terraform"
port = 3000
```

---

### 3. CI/CD Pipeline (Optional)

#### `.github/workflows/deploy.yml`
```yaml
name: Deploy Chatrix to AWS Lambda

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-west-2
  ECR_REPOSITORY: chatrix

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image to Amazon ECR
        id: build-image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest
          echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT

      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v3

      - name: Terraform Init
        run: |
          cd terraform
          terraform init

      - name: Terraform Plan
        run: |
          cd terraform
          terraform plan -var="image_tag=${{ github.sha }}"

      - name: Terraform Apply
        if: github.ref == 'refs/heads/main'
        run: |
          cd terraform
          terraform apply -auto-approve -var="image_tag=${{ github.sha }}"

      - name: Update Lambda function
        run: |
          aws lambda update-function-code \
            --function-name chatrix \
            --image-uri ${{ steps.build-image.outputs.image }}
```

---

## Deployment Workflow

### Initial Setup (One-time)

```bash
# 1. Create Terraform directory
mkdir -p terraform
cd terraform

# 2. Create all Terraform files (main.tf, variables.tf, outputs.tf, versions.tf)

# 3. Initialize Terraform
terraform init

# 4. Create AWS resources (ECR, IAM, Secrets, etc.)
terraform apply

# 5. Set the API key in Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id prod/chatrix/api-key \
  --secret-string '{"api_key":"your-secret-key-here"}' \
  --region us-west-2
```

### Build and Deploy Container Image

```bash
# 1. Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# 2. Authenticate Docker to ECR
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com

# 3. Build the Docker image
docker build -t chatrix:latest .

# 4. Tag the image for ECR
docker tag chatrix:latest ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/chatrix:latest

# 5. Push to ECR
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/chatrix:latest

# 6. Update Lambda function (Terraform will detect new image)
cd terraform
terraform apply
```

### Local Development with SAM

```bash
# 1. Build Lambda locally
sam build --hook-name terraform

# 2. Invoke Lambda locally
sam local invoke --hook-name terraform --event test-event.json

# 3. Start local API Gateway
sam local start-api --hook-name terraform --port 3000

# 4. Test locally
curl http://localhost:3000/health
curl -X POST http://localhost:3000/v1/messages \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

### Update Application Code

```bash
# 1. Make code changes
# 2. Rebuild and push image (steps from "Build and Deploy Container Image")
# 3. Update Lambda
aws lambda update-function-code \
  --function-name chatrix \
  --image-uri ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/chatrix:latest
```

---

## Testing Strategy

### 1. Local Testing (Before Deployment)
```bash
# Test with SAM CLI
sam build --hook-name terraform
sam local invoke --hook-name terraform

# Or run Docker directly
docker build -t chatrix:test .
docker run -p 3000:3000 \
  -e AWS_REGION=us-west-2 \
  -e SecretName=prod/chatrix/api-key \
  chatrix:test
```

### 2. Lambda Testing (After Deployment)
```bash
# Get Function URL
FUNCTION_URL=$(cd terraform && terraform output -raw lambda_function_url)

# Test health endpoint
curl ${FUNCTION_URL}/health

# Test chat endpoint
curl -X POST ${FUNCTION_URL}/v1/messages \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-7-sonnet-20250219",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 100
  }'
```

### 3. Claude Code Integration
```bash
# Configure Claude Code to use Lambda endpoint
export ANTHROPIC_API_URL="${FUNCTION_URL}/v1"
export ANTHROPIC_API_KEY="your-api-key"

# Test with Claude Code
claude -p "Who are you?" --model claude-3-7-sonnet-20250219
```

---

## Configuration Checklist

### AWS Prerequisites
- [ ] AWS account with appropriate permissions
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Bedrock model access enabled in us-west-2
- [ ] Docker installed locally

### Terraform Prerequisites
- [ ] Terraform >= 1.5.0 installed
- [ ] AWS credentials configured (CLI or environment variables)
- [ ] Decide on state backend (local or S3+DynamoDB)

### SAM CLI Prerequisites (Optional)
- [ ] SAM CLI installed (`pip install aws-sam-cli`)
- [ ] Docker running for local testing

---

## Decisions Made

### 1. API Exposure Method ✓
**Decision:** Lambda Function URL

**Why:**
- Direct HTTPS endpoint - simple and sufficient
- No API Gateway costs (~$1/month savings)
- Built-in CORS support
- Perfect for Claude Code proxy use case
- Authentication handled at application level (Bearer token)

## Decisions To Be Made Tomorrow

### 2. SAM Metadata Resource
**Question:** Include `sam metadata` resource for local testing?

**Options:**
- **Yes** - Enables `sam local invoke` and `sam local start-api`
- **No** - Simpler, only if you won't test locally with SAM

**Default:** Yes (low overhead, useful for development)

### 3. Terraform Remote State
**Question:** Use S3 backend for Terraform state?

**Options:**
- **Local state** (default) - Simple, single developer
- **S3 + DynamoDB** - Team collaboration, state locking

**Default:** Start local, migrate to S3 later if needed

### 4. Image Tagging Strategy
**Options:**
- **latest** - Simple, always overwrite
- **git SHA** - Traceable, rollback-friendly
- **semantic version** - Release-based

**Default:** Use `latest` for now

### 5. AWS Region
**Current:** us-west-2 (hardcoded in index.js)

**Default:** Keep us-west-2 (Bedrock model availability)

---

## Cost Estimation

### Lambda Costs (us-west-2)
- **Compute**: $0.0000133334 per GB-second
  - 512 MB = 0.5 GB
  - Average request: 2 seconds
  - Cost per request: ~$0.000013

- **Requests**: $0.20 per 1M requests
  - Cost per request: $0.0000002

- **Total per request**: ~$0.000013
- **1000 requests/day**: ~$0.40/month

### ECR Costs
- **Storage**: $0.10 per GB/month
  - Chatrix image: ~300 MB
  - Cost: ~$0.03/month

### Secrets Manager
- **Secret**: $0.40 per secret per month
- **API calls**: $0.05 per 10,000 API calls

### Bedrock Costs (Dominant)
- See BEDROCK_PRICING in index.js
- Claude 3.7 Sonnet: $3/1M input, $15/1M output tokens

**Total Infrastructure**: ~$1-2/month
**Bedrock Usage**: Variable based on traffic

---

## Troubleshooting Guide

### Common Issues

**1. "Error: no space left on device" during docker build**
```bash
# Clean up Docker
docker system prune -a --volumes
```

**2. "AccessDeniedException" calling Bedrock**
```bash
# Check IAM policy
aws iam get-role-policy --role-name chatrix-lambda-role --policy-name bedrock-access

# Verify Bedrock model access in console
# AWS Console → Bedrock → Model access
```

**3. "ResourceNotFoundException" for Secrets Manager**
```bash
# Verify secret exists
aws secretsmanager describe-secret --secret-id prod/chatrix/api-key

# Create secret value if missing
aws secretsmanager put-secret-value \
  --secret-id prod/chatrix/api-key \
  --secret-string '{"api_key":"your-key"}'
```

**4. Lambda cold start timeout**
```bash
# Increase Lambda timeout in terraform/main.tf
timeout = 60  # Increase from 30 to 60 seconds
```

**5. Container image too large**
```bash
# Check image size
docker images | grep chatrix

# If >10GB, optimize Dockerfile (add .dockerignore)
```

---

## Next Steps (Tomorrow)

1. **Review this plan** - Confirm approach and decisions
2. **Create Terraform files** - Implement infrastructure as code
3. **Test locally** - Verify container works with SAM CLI
4. **Deploy to AWS** - Run terraform apply
5. **Integration test** - Test with Claude Code
6. **Document** - Update README with deployment instructions

---

## References

- [AWS SAM + Terraform Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/gs-terraform-support.html)
- [AWS Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)
- [Bedrock Runtime API](https://docs.aws.amazon.com/bedrock/latest/APIReference/welcome.html)
