# SMB-Loyalty-Program

![Frontend CI](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/frontend-ci.yml/badge.svg)
![Backend CI](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/backend-ci.yml/badge.svg)
![E2E Tests](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/e2e-tests.yml/badge.svg)
![Deploy](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/deploy.yml/badge.svg)

We’re building a modern loyalty infrastructure that empowers small businesses and global enterprises alike to reward customers through seamless digital experiences—starting with QR-based programs for SMBs, and evolving into a blockchain-powered loyalty protocol for the future of partner ecosystems.

## GitHub Secrets
Add the following secrets under Settings > Secrets > Actions in your GitHub repository:

- **AWS_ACCESS_KEY_ID**: AWS access key for deployment actions
- **AWS_SECRET_ACCESS_KEY**: AWS secret access key for deployment actions
- **AWS_REGION**: AWS region for S3 and Elastic Beanstalk (e.g., `us-east-1`)
- **S3_BUCKET_NAME**: S3 bucket name for frontend hosting
- **EB_S3_BUCKET**: S3 bucket name for Elastic Beanstalk application versions
