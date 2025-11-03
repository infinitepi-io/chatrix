locals {
  # Extract domain from Lambda Function URL (remove https:// and trailing /)
  lambda_domain = trimprefix(trimsuffix(aws_lambda_function_url.chatrix.function_url, "/"), "https://")
  origin_id     = "chatrix-lambda"
  aliases       = ["chatrix.infinitepi-io.org"]
}

# ACM Certificate must be in us-east-1 for CloudFront
data "aws_acm_certificate" "chatrix" {
  provider = aws.infra_mgnt_use1
  domain   = "*.infinitepi-io.org"
  statuses = ["ISSUED"]
}

resource "aws_cloudfront_distribution" "chatrix" {
  provider = aws.infra_mgnt_usw2
  aliases  = local.aliases

  origin {
    domain_name = local.lambda_domain
    origin_id   = local.origin_id

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "https-only"
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
      origin_ssl_protocols     = ["TLSv1.2"]
    }
  }

  enabled         = true
  is_ipv6_enabled = true
  comment         = "CloudFront distribution for Chatrix Lambda Function"

  default_cache_behavior {
    # CloudFront requires GET/HEAD even if origin only accepts POST
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"

    # Use Managed-CachingDisabled policy for dynamic API
    cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

    # Use Managed-AllViewerExceptHostHeader origin request policy
    origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.chatrix.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "chatrix-cloudfront"
  }
}