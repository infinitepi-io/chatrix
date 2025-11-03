terraform {
  backend "s3" {
    bucket         = "infinitepi-io-aws-core-infrastructure-i989-main"
    key            = "infra-mgnt/chatrix"
    region         = "ap-south-1"
    dynamodb_table = "infinitepi-io-aws-core-infrastructure-i989-locks"
    encrypt        = true
    role_arn       = "arn:aws:iam::158710814571:role/infinitepi-io-aws-core-infrastructure-i989-state"
  }
}