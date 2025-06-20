# OpenID Connect Provider for EKS
# Required for IRSA (IAM Roles for Service Accounts)

# Get the TLS certificate for the EKS cluster
data "tls_certificate" "eks" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

# Create the OIDC provider
resource "aws_iam_openid_connect_provider" "eks" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer
  
  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-oidc-provider"
  })
}