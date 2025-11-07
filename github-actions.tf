# IAM Role for GitHub Actions to push to ECR
resource "aws_iam_role" "github_actions_ecr_push" {
  provider = aws.infra_mgnt_usw2
  name     = "deploy-chatrix-infra-mgnt-usw2"

  assume_role_policy = jsonencode({
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::158710814571:role/github-gateway"
            },
            "Action": [
                "sts:AssumeRole",
                "sts:TagSession"
            ]
        }
    ]
})

  tags = {
    Name = "deploy-chatrix-infra-mgnt-usw2"
  }
}

# IAM Policy for ECR push and Lambda update permissions
resource "aws_iam_policy" "github_actions_ecr_push" {
  provider    = aws.infra_mgnt_usw2
  name        = "deploy-chatrix-infra-mgnt-usw2-policy"
  description = "Allow GitHub Actions to push Docker images to ECR and update Lambda function"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "GetAuthorizationToken"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "ManageRepositoryContents"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = aws_ecr_repository.chatrix.arn
      },
      {
        Sid    = "UpdateLambdaFunction"
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration"
        ]
        Resource = aws_lambda_function.chatrix.arn
      }
    ]
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "github_actions_ecr_push" {
  provider   = aws.infra_mgnt_usw2
  role       = aws_iam_role.github_actions_ecr_push.name
  policy_arn = aws_iam_policy.github_actions_ecr_push.arn
}

# Output the role ARN for GitHub Actions configuration
output "github_actions_role_arn" {
  description = "IAM Role ARN for GitHub Actions to assume"
  value       = aws_iam_role.github_actions_ecr_push.arn
}
