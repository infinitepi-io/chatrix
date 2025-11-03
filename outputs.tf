output "lambda_function_url" {
  description = "Lambda Function URL endpoint"
  value       = aws_lambda_function_url.chatrix.function_url
}

output "lambda_function_arn" {
  description = "Lambda Function ARN"
  value       = aws_lambda_function.chatrix.arn
}

output "lambda_function_name" {
  description = "Lambda Function name"
  value       = aws_lambda_function.chatrix.function_name
}

output "ecr_repository_url" {
  description = "ECR Repository URL for pushing images"
  value       = aws_ecr_repository.chatrix.repository_url
}

output "secret_arn" {
  description = "Secrets Manager Secret ARN"
  value       = data.aws_secretsmanager_secret.chatrix_api_key.arn
}

output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name"
  value       = aws_cloudwatch_log_group.chatrix.name
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name (use this for CloudFlare CNAME)"
  value       = aws_cloudfront_distribution.chatrix.domain_name
}

output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = "https://${aws_cloudfront_distribution.chatrix.domain_name}"
}
