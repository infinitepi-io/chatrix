# ECR Repository for container images
resource "aws_ecr_repository" "chatrix" {
  provider             = aws.infra_mgnt_usw2
  name                 = "infinite-pi/${var.function_name}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ECR Lifecycle Policy - keep last 10 images
resource "aws_ecr_lifecycle_policy" "chatrix" {
  provider   = aws.infra_mgnt_usw2
  repository = aws_ecr_repository.chatrix.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = {
        type = "expire"
      }
    }]
  })
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "chatrix" {
  provider          = aws.infra_mgnt_usw2
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = var.log_retention_days
}

# Secrets Manager Secret for API key
data "aws_secretsmanager_secret" "chatrix_api_key" {
  provider = aws.infra_mgnt_usw2
  name     = var.secret_name
}

# IAM Role for Lambda
resource "aws_iam_role" "chatrix_lambda" {
  provider = aws.infra_mgnt_usw2
  name     = "${var.function_name}-lambda-role"

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

# IAM Policy for Bedrock and Secrets Manager access
resource "aws_iam_policy" "chatrix_permissions" {
  provider    = aws.infra_mgnt_usw2
  name        = "${var.function_name}-permissions"
  description = "Allow Lambda to invoke Bedrock models and read API key"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowInvokeModelWithResponseStream"
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:InvokeModel"
        ]
        Resource = ["*"]
      },
      {
        Sid    = "AllowGetApiKey"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "${data.aws_secretsmanager_secret.chatrix_api_key.arn}*"
        ]
      }
    ]
  })
}

# Attach policies to Lambda role
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  provider   = aws.infra_mgnt_usw2
  role       = aws_iam_role.chatrix_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "chatrix_permissions" {
  provider   = aws.infra_mgnt_usw2
  role       = aws_iam_role.chatrix_lambda.name
  policy_arn = aws_iam_policy.chatrix_permissions.arn
}

# Lambda Function (Container-based)
resource "aws_lambda_function" "chatrix" {
  provider      = aws.infra_mgnt_usw2
  function_name = var.function_name
  role          = aws_iam_role.chatrix_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.chatrix.repository_url}:${var.image_tag}"
  architectures = ["arm64"]

  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory

  environment {
    variables = {
      SecretName = data.aws_secretsmanager_secret.chatrix_api_key.name
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_iam_role_policy_attachment.chatrix_permissions,
    aws_cloudwatch_log_group.chatrix
  ]
}

# Lambda Function URL
resource "aws_lambda_function_url" "chatrix" {
  provider           = aws.infra_mgnt_usw2
  function_name      = aws_lambda_function.chatrix.function_name
  authorization_type = "NONE"

  cors {
    allow_credentials = true
    allow_origins     = ["*"]
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    max_age           = 86400
  }
}

