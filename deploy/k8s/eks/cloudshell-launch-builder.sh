# =============================================================================
# Alpha-Helix · EKS 빌드/ops 박스 런치 — 사용자(네) AWS 계정 CloudShell 에서 실행
#  - 네 계정에 t3.xlarge / 150GB / admin역할 / 네 id_ed25519 키 박힌 EC2 1대 기동.
#  - 여기서 담당자가 eksctl 클러스터 생성·워커 이미지 빌드/ECR 푸시·10회 검증 수행.
#  - 검증 끝나면 terminate (볼륨 자동삭제, delete-on-termination=true) → 비용 0.
# 비용: 기동중 ~230원/hr. 빌드 2~3시간 쓰고 terminate 하면 ~700원.
# =============================================================================
REGION=ap-northeast-2
NAME=alphahelix-eks-builder
# 네 로컬 ~/.ssh/id_ed25519.pub (이 키로 SSH 접속함)
PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIN9YFG9lf3XvzjKgEtuR/kggd+81GYIez7Ck6hO4EZ/1 hylee@yeona_lee"

# 1) 최신 Ubuntu 24.04 AMI (Canonical SSM 파라미터)
AMI=$(aws ssm get-parameter --region $REGION \
  --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id \
  --query Parameter.Value --output text)
echo "AMI=$AMI"

# 2) 기본 VPC 서브넷
SUBNET=$(aws ec2 describe-subnets --region $REGION \
  --filters Name=default-for-az,Values=true --query "Subnets[0].SubnetId" --output text)
VPC=$(aws ec2 describe-subnets --region $REGION --subnet-ids $SUBNET \
  --query "Subnets[0].VpcId" --output text)
echo "SUBNET=$SUBNET VPC=$VPC"

# 3) 키페어 등록(네 공개키)
echo "$PUBKEY" > /tmp/k.pub
aws ec2 import-key-pair --region $REGION --key-name $NAME-key \
  --public-key-material fileb:///tmp/k.pub 2>/dev/null || echo "key 이미 있음"

# 4) 보안그룹(SSH 22). 키인증 전용·임시라 0.0.0.0/0 허용(검증 후 박스 terminate).
SG=$(aws ec2 create-security-group --region $REGION --group-name $NAME-sg \
  --description "alphahelix eks builder ssh" --vpc-id $VPC --query GroupId --output text 2>/dev/null \
  || aws ec2 describe-security-groups --region $REGION \
       --filters Name=group-name,Values=$NAME-sg --query "SecurityGroups[0].GroupId" --output text)
aws ec2 authorize-security-group-ingress --region $REGION --group-id $SG \
  --protocol tcp --port 22 --cidr 0.0.0.0/0 2>/dev/null || true
echo "SG=$SG"

# 5) IAM admin 역할 + 인스턴스 프로파일(eksctl/ECR/EC2 전권 — 검증 후 떼면 됨)
ROLE=$NAME-role
cat > /tmp/trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF
aws iam get-role --role-name $ROLE >/dev/null 2>&1 || \
  aws iam create-role --role-name $ROLE --assume-role-policy-document file:///tmp/trust.json >/dev/null
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
aws iam get-instance-profile --instance-profile-name $ROLE >/dev/null 2>&1 || \
  aws iam create-instance-profile --instance-profile-name $ROLE >/dev/null
aws iam add-role-to-instance-profile --instance-profile-name $ROLE --role-name $ROLE 2>/dev/null || true
sleep 10

# 6) EC2 기동 (t3.xlarge / 150GB gp3 / 종료시 볼륨삭제)
IID=$(aws ec2 run-instances --region $REGION \
  --image-id $AMI --instance-type t3.xlarge \
  --key-name $NAME-key --security-group-ids $SG --subnet-id $SUBNET \
  --iam-instance-profile Name=$ROLE \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":150,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=alphahelix-eks-builder}]' \
  --query "Instances[0].InstanceId" --output text)
echo "INSTANCE=$IID 기동중..."
aws ec2 wait instance-running --region $REGION --instance-ids $IID
IP=$(aws ec2 describe-instances --region $REGION --instance-ids $IID \
  --query "Reservations[0].Instances[0].PublicIpAddress" --output text)
echo "=================================================="
echo "✅ 빌드박스 준비 완료 — 이 줄 그대로 담당자에게 전달:"
echo "   PUBLIC_IP=$IP  INSTANCE_ID=$IID  REGION=$REGION"
echo "   SSH = ssh -i ~/.ssh/id_ed25519 ubuntu@$IP"
echo "=================================================="

# ── 검증 끝난 뒤 정리(비용 0) ─────────────────────────────────────────────
# aws ec2 terminate-instances --region ap-northeast-2 --instance-ids $IID
#   (EKS 클러스터는 담당자가 eksctl delete cluster 로 삭제)
