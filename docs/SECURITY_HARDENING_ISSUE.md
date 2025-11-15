# Security Hardening for Lambda + Bedrock Setup

## Current Architecture
- Lambda with Function URL → CloudFront → satish.test.com
- User passes `ANTHROPIC_AUTH_TOKEN` in request
- Lambda validates token against AWS Secrets Manager
- Lambda calls Bedrock if token is valid

## Security Improvements

### 1. Lock Down Lambda Function URL with IAM Authentication

**Problem:** Lambda Function URL is publicly accessible. Anyone who discovers the direct URL can bypass CloudFront.

**Solution:** Configure Function URL to use `AWS_IAM` authentication mode.

**How it works:**
- Set Lambda Function URL auth type to `AWS_IAM`
- CloudFront will sign requests using IAM credentials (via Lambda@Edge or origin access identity)
- Direct access to function URL without proper IAM signature will be rejected
- Only CloudFront (with proper IAM role) can invoke the Lambda

**Benefits:**
- Prevents direct function URL access completely
- No custom header validation needed in Lambda code
- AWS-native security mechanism

**Trade-off:** Requires setting up IAM roles and CloudFront origin configuration for signing requests.

---

### 2. CloudFront Custom Header Validation (Alternative to IAM)

**Problem:** Same as above - direct Lambda URL access possible.

**Solution:** CloudFront adds a secret header that Lambda validates.

**How it works:**
- CloudFront origin custom headers: Add `X-CloudFront-Secret: <random-strong-value>`
- Lambda checks for this header before processing
- Store the secret value in Lambda environment variable or Secrets Manager
- Reject requests without the correct header

**Benefits:**
- Simpler than IAM-based function URL auth
- Easy to implement
- CloudFront-specific protection

**Trade-off:** Requires code changes in Lambda to validate header.

---

### 3. Rate Limiting with DynamoDB

**Problem:** No protection against request spam or brute force attacks.

**Solution:** Implement per-IP rate limiting using DynamoDB.

**How it works:**
- Create DynamoDB table with IP as partition key
- Track request count and timestamps per IP
- Use TTL to auto-delete old entries
- Lambda checks rate limit before processing request
- Return 429 (Too Many Requests) if limit exceeded

**Benefits:**
- Very cheap (~$0.25-$1/month with on-demand pricing)
- Protects against abuse and runaway costs
- Flexible limits (per IP, per hour/day)

**Configuration:**
- Set limits like 100 requests per hour per IP
- Adjust based on legitimate usage patterns

---

### 4. CloudFront Functions for Request Processing

**Problem:** Lambda@Edge is expensive for simple request modifications.

**Solution:** Use CloudFront Functions for lightweight request processing.

**How it works:**
- CloudFront Functions run at CloudFront edge locations
- Add custom headers to requests before reaching origin
- Very cheap ($0.10 per 1M invocations)
- Can add the CloudFront secret header here

**Use cases:**
- Adding custom validation headers
- Simple request inspection
- Header manipulation

---

### 5. Lambda Reserved Concurrency

**Problem:** Unlimited Lambda invocations could cause cost spikes.

**Solution:** Set reserved concurrency limit on Lambda function.

**How it works:**
- Configure maximum concurrent Lambda executions (e.g., 10)
- AWS will throttle requests beyond this limit
- Protects against runaway costs from abuse

**Benefits:**
- Hard cap on Lambda scaling
- Prevents cost surprises
- Free to configure

**Trade-off:** May throttle legitimate traffic during spikes.

---

### 6. Token Security Best Practices

**Current:** Token stored in Secrets Manager ✅

**Additional hardening:**
- Ensure token is cryptographically strong (32+ random characters)
- Pass token in `Authorization: Bearer <token>` header only (never in URL)
- Implement token rotation schedule (e.g., every 90 days)
- Use Secrets Manager automatic rotation if possible
- Consider multiple tokens for different users/systems

---

### 7. CloudWatch Monitoring & Alarms

**Problem:** No visibility into abuse or unusual patterns.

**Solution:** Set up CloudWatch alarms and dashboards.

**Metrics to monitor:**
- Lambda invocation count (alert on spikes)
- Lambda error rate (alert on auth failures)
- Lambda duration (alert on performance issues)
- Estimated Bedrock costs (alert on spend thresholds)

**Alarms to create:**
- High invocation rate (>1000/5min)
- High error rate (>10% failures)
- 401 Unauthorized spike (potential brute force)
- Lambda throttles (capacity issues)

---

### 8. Logging Hygiene

**Problem:** Tokens could be logged and exposed.

**Solution:** Sanitize logs to prevent token leakage.

**Best practices:**
- Never log request headers containing tokens
- Never log full event objects
- Log only non-sensitive data (IP, timestamp, status code)
- Enable CloudFront access logs (doesn't contain auth headers)
- Review Lambda logs regularly for accidental token exposure

---

### 9. HTTPS Enforcement

**Current:** CloudFront provides HTTPS ✅

**Additional hardening:**
- Configure CloudFront to redirect HTTP to HTTPS
- Set CloudFront viewer protocol policy to "Redirect HTTP to HTTPS" or "HTTPS Only"
- Add HSTS header via CloudFront Response Headers Policy
- Ensure Lambda Function URL uses HTTPS (default, but verify)

---

### 10. Lambda IAM Role Least Privilege

**Problem:** Lambda might have overly broad Bedrock permissions.

**Solution:** Restrict Lambda IAM role to minimum required permissions.

**Required permissions:**
- `bedrock:InvokeModel` for specific model ARNs only
- `secretsmanager:GetSecretValue` for specific secret ARN only
- `dynamodb:GetItem`, `dynamodb:PutItem` for rate limit table only
- CloudWatch Logs permissions

**Example policy structure:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-*"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:region:account:secret:bedrock-auth-token-*"
    }
  ]
}
```

---

### 11. CloudFront Response Headers Policy

**Problem:** Missing security headers in responses.

**Solution:** Add security headers via CloudFront Response Headers Policy.

**Headers to add:**
- `Strict-Transport-Security: max-age=63072000` (enforce HTTPS)
- `X-Content-Type-Options: nosniff` (prevent MIME sniffing)
- `X-Frame-Options: DENY` (prevent clickjacking)
- `X-XSS-Protection: 1; mode=block` (XSS protection)
- `Content-Security-Policy` (if serving HTML responses)

**Benefits:**
- Free to implement
- Industry-standard security headers
- Protects against common web vulnerabilities

---

### 12. DDoS Protection (Built-in)

**Current:** CloudFront provides basic DDoS protection ✅

**Additional considerations:**
- AWS Shield Standard is automatically enabled on CloudFront (free)
- Protects against most common DDoS attacks
- For advanced protection, AWS Shield Advanced available ($3000/month - probably not needed)

---

## Recommended Priority Order

### High Priority (Do First)
1. **IAM-based Function URL authentication** OR **CloudFront custom header validation**
2. **Lambda reserved concurrency** (cost protection)
3. **Token passed in Authorization header** (not URL params)
4. **Lambda IAM role least privilege**

### Medium Priority
5. **DynamoDB rate limiting** (cheap and effective)
6. **CloudWatch alarms** (monitoring and alerts)
7. **Logging hygiene** (prevent token leakage)
8. **HTTPS enforcement** (if not already configured)

### Low Priority (Nice to Have)
9. **CloudFront Functions** (optimization)
10. **CloudFront Response Headers Policy** (defense in depth)
11. **Token rotation schedule** (operational security)

---

## Cost Estimate (Without WAF)

| Component | Monthly Cost |
|-----------|--------------|
| CloudFront | $0 (existing) |
| CloudFront Functions | ~$0.10 |
| Lambda invocations | ~$0.20 |
| DynamoDB on-demand | ~$0.50 |
| Secrets Manager | ~$0.40 |
| CloudWatch Logs | ~$1.00 |
| **Total** | **~$2-3/month** |

---

## Architecture Decision: IAM vs Custom Header

### Option A: IAM-Based Function URL (Recommended)
**Pros:**
- Most secure AWS-native approach
- No custom code needed in Lambda for CloudFront validation
- Leverages AWS IAM signature verification

**Cons:**
- More complex CloudFront setup
- Requires understanding of IAM roles and signing

### Option B: CloudFront Custom Header
**Pros:**
- Simpler to implement
- Easy to understand and debug
- Minimal CloudFront configuration

**Cons:**
- Requires Lambda code changes
- Custom validation logic needed
- Slightly less secure than IAM (but still very good)

**Recommendation:** Start with Option B (custom header) for quick implementation, migrate to Option A (IAM) for production hardening.
