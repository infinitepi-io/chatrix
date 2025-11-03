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

#### Directory Structure
```
chatrix/
├── terraform/
│   ├── main.tf           # Core infrastructure resources
│   ├── variables.tf      # Input variables
│   ├── outputs.tf        # Output values
│   ├── versions.tf       # Provider versions and backend config
│   └── terraform.tfvars  # Variable values (optional)
├── samconfig.toml        # SAM CLI configuration (optional)
└── .github/
    └── workflows/
        └── deploy.yml    # CI/CD pipeline (optional)
```

#### Resources to Define in `terraform/main.tf`

1. **ECR Repository**
   - Container registry for Docker images
   - Image scanning on push for security
   - Lifecycle policy to keep last 10 images
   - Prevent destroy to protect production images

2. **Lambda Function (Container-based)**
   - Package type: Image
   - Memory: 512 MB
   - Timeout: 30 seconds
   - Environment variables: SecretName, AWS_REGION
   - Dependencies: IAM role, CloudWatch log group

3. **IAM Role and Policies**
   - Lambda execution role
   - Bedrock access policy (InvokeModel, InvokeModelWithResponseStream)
   - Secrets Manager read policy (GetSecretValue)
   - CloudWatch Logs policy (via AWSLambdaBasicExecutionRole)

4. **Secrets Manager Secret**
   - Secret name: `prod/chatrix/api-key`
   - Recovery window: 7 days
   - Note: Secret value set manually via AWS CLI

5. **CloudWatch Log Group**
   - Log group: `/aws/lambda/chatrix`
   - Retention: 7 days

6. **Lambda Function URL**
   - Authorization: NONE (app-level auth with Bearer token)
   - CORS: Allow all origins, methods, headers
   - Max age: 86400 seconds

7. **SAM Metadata (Optional)**
   - Enables local testing with SAM CLI
   - Points to Dockerfile and docker context
   - Null resource (no AWS resource created)

#### Variables to Define in `terraform/variables.tf`

- `function_name` - Lambda function name (default: "chatrix")
- `aws_region` - AWS region (default: "us-west-2")
- `image_tag` - Docker image tag (default: "latest")
- `secret_name` - Secrets Manager secret name (default: "prod/chatrix/api-key")

#### Outputs to Define in `terraform/outputs.tf`

- `lambda_function_url` - HTTPS endpoint for Lambda
- `lambda_function_arn` - Lambda ARN
- `ecr_repository_url` - ECR repository URL for pushing images
- `secret_arn` - Secrets Manager secret ARN

#### Provider Configuration in `terraform/versions.tf`

- Terraform version: >= 1.5.0
- AWS provider version: ~> 5.0
- Optional: S3 backend for remote state (commented out by default)

---

### 2. SAM Configuration (Optional)

#### `samconfig.toml`
- Configure SAM CLI to use Terraform hook
- Set default port for local API (3000)
- Enable easier local development workflow

---

### 3. CI/CD Pipeline (Optional)

#### `.github/workflows/deploy.yml`
- Trigger: Push to main branch or manual workflow dispatch
- Steps:
  1. Checkout code
  2. Configure AWS credentials
  3. Login to ECR
  4. Build and push Docker image (tagged with git SHA + latest)
  5. Run Terraform init
  6. Run Terraform plan
  7. Run Terraform apply (on main branch only)
  8. Update Lambda function code with new image

---

## Deployment Workflow

### Phase 1: Initial Setup (One-time)

1. Create `terraform/` directory
2. Create all Terraform configuration files
3. Run `terraform init` to initialize providers
4. Run `terraform apply` to create infrastructure
5. Set API key in Secrets Manager using AWS CLI

### Phase 2: Build and Deploy Container

1. Get AWS account ID
2. Authenticate Docker to ECR
3. Build Docker image locally
4. Tag image for ECR repository
5. Push image to ECR
6. Run `terraform apply` to update Lambda (or use `aws lambda update-function-code`)

### Phase 3: Local Development (Optional)

1. Run `sam build --hook-name terraform`
2. Test locally with `sam local invoke` or `sam local start-api`
3. Make code changes and iterate locally before deploying

### Phase 4: Update Application

1. Make code changes
2. Rebuild and push Docker image
3. Update Lambda function via AWS CLI or Terraform

---

## Testing Strategy

### 1. Local Testing (Before Deployment)
- Use SAM CLI to test Lambda locally
- Or run Docker container directly with environment variables
- Test health endpoint and chat endpoint

### 2. Lambda Testing (After Deployment)
- Get Function URL from Terraform outputs
- Test health endpoint with curl
- Test chat endpoint with curl and API key
- Verify logs in CloudWatch

### 3. Claude Code Integration
- Configure Claude Code to use Lambda Function URL
- Set ANTHROPIC_API_URL and ANTHROPIC_API_KEY environment variables
- Test with `claude -p "test" --model claude-3-7-sonnet-20250219`

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

---

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
- Claude 3.7 Sonnet: $3/1M input, $15/1M output tokens
- Variable based on usage

**Total Infrastructure**: ~$1-2/month
**Bedrock Usage**: Variable based on traffic

---

## Troubleshooting Guide

### Common Issues

**1. "Error: no space left on device" during docker build**
- Solution: Clean up Docker with `docker system prune -a --volumes`

**2. "AccessDeniedException" calling Bedrock**
- Check IAM policy attachments
- Verify Bedrock model access enabled in AWS Console → Bedrock → Model access

**3. "ResourceNotFoundException" for Secrets Manager**
- Verify secret exists: `aws secretsmanager describe-secret --secret-id prod/chatrix/api-key`
- Create secret value if missing

**4. Lambda cold start timeout**
- Increase timeout in terraform/main.tf from 30 to 60 seconds

**5. Container image too large**
- Check image size: `docker images | grep chatrix`
- Optimize Dockerfile and add .dockerignore if needed

---

## Next Steps (Tomorrow)

1. **Review this plan** - Confirm approach and decisions
2. **Create Terraform files** - Implement infrastructure as code
3. **Test locally** - Verify container works with SAM CLI
4. **Deploy to AWS** - Run terraform apply
5. **Integration test** - Test with Claude Code
6. **Document** - Update README with deployment instructions

---

## Key Commands Reference

### Initial Setup
```bash
mkdir -p terraform
cd terraform
terraform init
terraform apply
```

### Build and Deploy
```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com
docker build -t chatrix:latest .
docker tag chatrix:latest ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/chatrix:latest
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.us-west-2.amazonaws.com/chatrix:latest
cd terraform && terraform apply
```

### Local Testing
```bash
sam build --hook-name terraform
sam local invoke --hook-name terraform
sam local start-api --hook-name terraform --port 3000
```

### Set API Key
```bash
aws secretsmanager put-secret-value \
  --secret-id prod/chatrix/api-key \
  --secret-string '{"api_key":"your-secret-key-here"}' \
  --region us-west-2
```

### Get Lambda URL
```bash
cd terraform && terraform output -raw lambda_function_url
```

---

## References

- [AWS SAM + Terraform Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/gs-terraform-support.html)
- [AWS Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter)
- [Bedrock Runtime API](https://docs.aws.amazon.com/bedrock/latest/APIReference/welcome.html)
