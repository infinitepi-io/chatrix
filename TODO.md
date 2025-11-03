# Chatrix TODO

## Open Issues & Follow-ups

### SAM CLI + Terraform + IMAGE_LAMBDA_FUNCTION Bug

**GitHub Issue**: https://github.com/aws/aws-sam-cli/issues/8388
**Status**: Open
**Created**: 2025-11-02
**Priority**: Medium

**Summary**:
SAM CLI's Terraform hook does not support `IMAGE_LAMBDA_FUNCTION` metadata type despite being documented. The SAM CLI parser ignores the `null_resource` with SAM metadata for container-based Lambda functions.

**Impact**:

- Cannot use `sam build --hook-name terraform` for local testing
- Cannot use `sam local invoke` with Terraform-defined container Lambda functions
- Must use alternative local testing methods (Docker Compose, manual Docker builds)

**Next Steps**:

1. Monitor the GitHub issue for AWS team response
2. If fixed, add SAM metadata back to `main.tf`:
   ```hcl
   resource "null_resource" "sam_metadata_aws_lambda_function_chatrix" {
     triggers = {
       resource_name      = "aws_lambda_function.chatrix"
       resource_type      = "IMAGE_LAMBDA_FUNCTION"
       docker_context     = path.root
       docker_file        = "Dockerfile"
       docker_tag         = var.image_tag
     }
   }
   ```
3. Re-add `null` provider to `provider.tf`:
   ```hcl
   null = {
     source  = "hashicorp/null"
     version = "~> 3.0"
   }
   ```
4. Test SAM local invoke functionality

**Workarounds** (current):

- Use Docker directly for local testing:
  ```bash
  docker build -t chatrix:local .
  docker run -p 3000:3000 -e AWS_REGION=us-west-2 chatrix:local
  ```
- Use Docker Compose for full environment simulation
- Deploy to AWS and test with Lambda Function URL

---

## Deployment Checklist

- [X] Configure AWS credentials
- [X] Run `tofu init` to initialize providers
- [X] Run `tofu validate` to check configuration
- [ ] Verify/Request ACM certificate for `*.infinitepi-io.org` in us-east-1
- [ ] Deploy ECR repository with `tofu apply -target=aws_ecr_repository.chatrix`
- [ ] Build and push Docker image to ECR
- [ ] Deploy Lambda, Function URL, and CloudFront with `tofu apply`
- [ ] Configure CloudFlare DNS CNAME pointing to CloudFront
- [ ] Test endpoint at https://chatrix.infinitepi-io.org

---

## Future Enhancements

### Security

- [ ] Add API key validation at CloudFront edge (Lambda@Edge)
- [ ] Implement rate limiting
- [ ] Add AWS WAF rules for DDoS protection

### Monitoring

- [ ] Set up CloudWatch alarms for Lambda errors
- [ ] Add X-Ray tracing for debugging
- [ ] Create CloudWatch dashboard for metrics

### Performance

- [ ] Optimize Docker image size
- [ ] Implement Lambda provisioned concurrency if needed
- [ ] Add CloudFront caching for health check endpoint

### Documentation

- [ ] Document local development setup
- [ ] Add deployment runbook
- [ ] Create troubleshooting guide
