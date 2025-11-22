# Spacelift Deployment Guide

This guide explains how to deploy Chatrix using Spacelift with proper secret management.

## Overview

The repository uses Terraform variables to keep sensitive information (domains, AWS account IDs) out of the public codebase. Spacelift injects these values at deployment time.

## Required Spacelift Configuration

### Environment Variables

Set these in your Spacelift Stack → Environment:

```bash
# Required for CloudFront custom domain
TF_VAR_domain_name=chatrix.infinitepi-io.org
TF_VAR_acm_certificate_domain=*.infinitepi-io.org

# Optional overrides (defaults exist in variables.tf)
TF_VAR_function_name=chatrix
TF_VAR_image_tag=latest
TF_VAR_lambda_timeout=60
TF_VAR_lambda_memory=512
TF_VAR_log_retention_days=7
TF_VAR_aws_region=us-west-2
TF_VAR_secret_name=prod/chatrix/api-key
```

### Context Variables (Recommended)

Create a Spacelift Context (e.g., `chatrix-config`) with these variables, then attach to your stack:

**Variables:**
- `TF_VAR_domain_name` = `chatrix.infinitepi-io.org`
- `TF_VAR_acm_certificate_domain` = `*.infinitepi-io.org`

**Benefits:**
- Reusable across multiple stacks
- Centralized secret management
- Version controlled context configuration

## Deployment Without Custom Domain

If you want to deploy without CloudFront (using just Lambda Function URL):

**Option 1: Set variables to empty strings**
```bash
TF_VAR_domain_name=""
TF_VAR_acm_certificate_domain=""
```

**Option 2: Don't set the variables**
The defaults are empty strings, so CloudFront won't be created.

## Stack Configuration

### Backend Configuration

The `backend.tf` file contains:
- S3 bucket for state storage
- DynamoDB table for state locking
- IAM role for state access

**Note:** These values are specific to your AWS environment. If sharing this repo, others should update `backend.tf` with their own S3 backend.

### Recommended Stack Settings

**VCS Integration:**
- Repository: `infinitepi-io/chatrix`
- Branch: `main`
- Project root: `/`

**Terraform:**
- Version: Use latest OpenTofu or Terraform 1.5+
- Workflow: Standard (Plan → Confirm → Apply)

**Policies:**
- Auto-deploy: Only on tracked runs
- Auto-retry: Disabled (manual approval preferred)

## Deployment Workflow

### Initial Deployment

1. **Create Spacelift Stack**
   - Connect to your GitHub repository
   - Set environment variables (domain, certificate)
   - Configure AWS provider credentials

2. **Deploy ECR Repository First** (optional)
   ```bash
   # In Spacelift, you can use terraform plan with -target
   # Or just deploy everything at once
   ```

3. **Build and Push Docker Image**
   - GitHub Actions will handle this on release
   - Or manually build and push to ECR

4. **Deploy Full Infrastructure**
   - Lambda function
   - Function URL
   - CloudFront (if domain variables set)
   - IAM roles and policies

5. **Configure DNS**
   - Point your domain CNAME to CloudFront distribution
   - Verify SSL certificate

### Updates

**Code Changes:**
- Push to `main` branch
- GitHub Actions builds and deploys new image
- Lambda automatically uses new image

**Infrastructure Changes:**
- Modify `.tf` files
- Push to repository
- Spacelift auto-triggers plan
- Review and confirm in Spacelift UI

## Security Best Practices

### Spacelift Security

1. **Use Contexts for Sensitive Values**
   - Keep domain names in Spacelift Contexts
   - Mark sensitive values as "secret" in Spacelift

2. **AWS Credentials**
   - Use IAM role assumption (OIDC preferred)
   - Never commit AWS keys to repository
   - Spacelift Cloud Integration handles this automatically

3. **State File Security**
   - State files contain sensitive information
   - Ensure S3 bucket has encryption enabled
   - Restrict access with IAM policies
   - Use DynamoDB locking to prevent concurrent modifications

### Variable Precedence

Spacelift uses standard Terraform variable precedence:
1. CLI flags (not applicable in Spacelift)
2. Environment variables (`TF_VAR_*`)
3. `terraform.tfvars` (not used, in .gitignore)
4. Variable defaults in `variables.tf`

## Troubleshooting

### "Error: Invalid count argument"

If CloudFront fails with count errors:
- Ensure `TF_VAR_domain_name` is set
- Ensure `TF_VAR_acm_certificate_domain` is set
- Verify ACM certificate exists in us-east-1

### "Certificate not found"

- ACM certificate must be in **us-east-1** for CloudFront
- Certificate must be in ISSUED status
- Domain must match the pattern (e.g., `*.infinitepi-io.org`)

### State Locking Issues

If state is locked:
- Check DynamoDB table for lock entry
- Force unlock via Spacelift UI if needed
- Ensure only one Spacelift run at a time

## Example Spacelift Configuration

```yaml
# Example spacelift.yml (if using)
version: 1

stack:
  name: chatrix-production
  description: Chatrix API proxy for AWS Bedrock

  vendor:
    terraform:
      version: 1.5.0

  environment:
    - name: TF_VAR_domain_name
      value: chatrix.infinitepi-io.org

    - name: TF_VAR_acm_certificate_domain
      value: "*.infinitepi-io.org"
```

## Local Development

For local testing with these variables:

```bash
# Create terraform.tfvars (git-ignored)
cat > terraform.tfvars <<EOF
domain_name            = "chatrix.infinitepi-io.org"
acm_certificate_domain = "*.infinitepi-io.org"
EOF

# Or use environment variables
export TF_VAR_domain_name="chatrix.infinitepi-io.org"
export TF_VAR_acm_certificate_domain="*.infinitepi-io.org"

# Then run terraform/tofu commands
tofu plan
tofu apply
```

## Migration from Hardcoded Values

If you previously had hardcoded domains in `cloudfront.tf`:

1. **Before migration:** Note your current domain values
2. **Add variables to Spacelift:** Set `TF_VAR_*` variables
3. **Trigger plan:** Spacelift should show no changes (same values, different source)
4. **Apply:** Infrastructure remains unchanged, just using variables now
5. **Commit updated code:** Push the variablized `cloudfront.tf`

This ensures zero downtime during the migration.