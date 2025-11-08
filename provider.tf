terraform {
  required_version = "~> 1.2"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

locals {
  default_tags = {
    "Environment"     = "Production"
    "ManagedBy"       = "Terraform"
    "SpendAllocation" = "Infrastructure"
  }
}

# Default provider
provider "aws" {
  region              = "us-west-2"
  allowed_account_ids = ["158710814571"]
  # assume_role {
  #   role_arn = "arn:aws:iam::158710814571:role/spacelift-functional"
  # }
  default_tags { tags = local.default_tags }
}

provider "aws" {
  alias               = "infra_mgnt_aps1"
  region              = "ap-south-1"
  allowed_account_ids = ["158710814571"]
  # assume_role {
  #   role_arn = "arn:aws:iam::158710814571:role/spacelift-functional"
  # }
  default_tags { tags = local.default_tags }
}
provider "aws" {
  alias               = "infra_mgnt_usw2"
  region              = "us-west-2"
  allowed_account_ids = ["158710814571"]
  # assume_role {
  #   role_arn = "arn:aws:iam::158710814571:role/spacelift-functional"
  # }
  default_tags { tags = local.default_tags }
}

# us-east-1 provider for ACM certificate (required for CloudFront)
provider "aws" {
  alias               = "infra_mgnt_use1"
  region              = "us-east-1"
  allowed_account_ids = ["158710814571"]
  # assume_role {
  #   role_arn = "arn:aws:iam::158710814571:role/spacelift-functional"
  # }
  default_tags { tags = local.default_tags }
}