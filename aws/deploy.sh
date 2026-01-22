#!/bin/bash

# AWS ECS Deployment Script for Loan Amortization Simulator
# Update these variables with your AWS account details

AWS_ACCOUNT_ID="YOUR_ACCOUNT_ID"
AWS_REGION="us-east-1"
CLUSTER_NAME="loan-simulation"
SERVICE_NAME="loan-sim-service"

# ECR repository names
BACKEND_REPO="loan-sim-backend"
FRONTEND_REPO="loan-sim-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting AWS ECS Deployment...${NC}"

# Login to ECR
echo -e "${GREEN}Logging in to ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

# Create ECR repositories if they don't exist
echo -e "${GREEN}Creating ECR repositories...${NC}"
aws ecr describe-repositories --repository-names $BACKEND_REPO --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name $BACKEND_REPO --region $AWS_REGION

aws ecr describe-repositories --repository-names $FRONTEND_REPO --region $AWS_REGION 2>/dev/null || \
    aws ecr create-repository --repository-name $FRONTEND_REPO --region $AWS_REGION

# Build Docker images
echo -e "${GREEN}Building Docker images...${NC}"
cd "$(dirname "$0")/.."
docker-compose build

# Tag images
echo -e "${GREEN}Tagging images...${NC}"
docker tag loan_simulation-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$BACKEND_REPO:latest
docker tag loan_simulation-frontend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$FRONTEND_REPO:latest

# Push images to ECR
echo -e "${GREEN}Pushing images to ECR...${NC}"
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$BACKEND_REPO:latest
docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$FRONTEND_REPO:latest

# Create CloudWatch log group
echo -e "${GREEN}Creating CloudWatch log group...${NC}"
aws logs create-log-group --log-group-name /ecs/loan-simulation --region $AWS_REGION 2>/dev/null || true

# Update task definition with actual values
echo -e "${GREEN}Updating task definition...${NC}"
sed -e "s/YOUR_ACCOUNT_ID/$AWS_ACCOUNT_ID/g" \
    -e "s/YOUR_REGION/$AWS_REGION/g" \
    aws/task-definition.json > /tmp/task-definition.json

# Register task definition
echo -e "${GREEN}Registering task definition...${NC}"
aws ecs register-task-definition --cli-input-json file:///tmp/task-definition.json --region $AWS_REGION

# Create or update ECS cluster
echo -e "${GREEN}Creating/updating ECS cluster...${NC}"
aws ecs describe-clusters --clusters $CLUSTER_NAME --region $AWS_REGION 2>/dev/null | grep -q "ACTIVE" || \
    aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $AWS_REGION

# Check if service exists and update or create
echo -e "${GREEN}Deploying service...${NC}"
if aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION 2>/dev/null | grep -q "ACTIVE"; then
    echo -e "${YELLOW}Updating existing service...${NC}"
    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --task-definition loan-simulation \
        --force-new-deployment \
        --region $AWS_REGION
else
    echo -e "${YELLOW}Creating new service...${NC}"
    echo -e "${RED}NOTE: You need to create the service manually with proper VPC/subnet configuration:${NC}"
    echo ""
    echo "aws ecs create-service \\"
    echo "    --cluster $CLUSTER_NAME \\"
    echo "    --service-name $SERVICE_NAME \\"
    echo "    --task-definition loan-simulation \\"
    echo "    --desired-count 1 \\"
    echo "    --launch-type FARGATE \\"
    echo "    --network-configuration \"awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}\" \\"
    echo "    --region $AWS_REGION"
fi

echo -e "${GREEN}Deployment complete!${NC}"
