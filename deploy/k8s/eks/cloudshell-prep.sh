# =============================================================================
# Alpha-Helix · EKS 빌드/ops 서버 준비 — AWS CloudShell 붙여넣기용
# 실행: AWS 콘솔 우측상단 >_ (CloudShell) 열고, admin 권한 친구가 BLOCK A 통째 복붙.
#  - BLOCK A = 무중단 (IAM 역할 + 디스크 150GB).  ← 먼저 이것만 돌리면 됨
#  - BLOCK B = 다운타임 (타입 t3.xlarge, stop/start). 점검시간에만 별도 실행.
#  - BLOCK C = (선택) Elastic IP 고정.  라이브 IP 보호용.
# OS 안 파티션 확장(resize2fs)·검증·EKS 작업은 담당자가 SSH로 이어서 처리.
# =============================================================================

# ─────────────────────────── BLOCK A (무중단) ───────────────────────────
REGION=ap-northeast-2

# ★ 바꾸려는 인스턴스: ID 알면 INSTANCE_ID 에 직접, 모르면 PUBLIC_IP 로 자동검색.
INSTANCE_ID=""                       # 예: i-0abc123...  (비우면 아래 IP로 찾음)
PUBLIC_IP="43.202.176.160"           # ← 이 IP가 바꾸려는 인스턴스 맞는지 꼭 확인!

if [ -z "$INSTANCE_ID" ]; then
  INSTANCE_ID=$(aws ec2 describe-instances --region $REGION \
    --filters "Name=ip-address,Values=$PUBLIC_IP" \
    --query "Reservations[].Instances[].InstanceId" --output text)
fi
if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo "!! 인스턴스를 못 찾음 — INSTANCE_ID 를 직접 넣고 다시 실행";
else
  read VOLUME_ID AZ ITYPE <<<"$(aws ec2 describe-instances --region $REGION \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].[BlockDeviceMappings[0].Ebs.VolumeId,Placement.AvailabilityZone,InstanceType]' \
    --output text)"
  echo "대상  INSTANCE_ID=$INSTANCE_ID  VOLUME_ID=$VOLUME_ID  AZ=$AZ  CURRENT_TYPE=$ITYPE"

  echo "===== STEP 1: IAM 역할(AdministratorAccess) 부착 — 무중단 ====="
  ROLE=alphahelix-eks-builder
  cat > /tmp/trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF
  aws iam get-role --role-name $ROLE >/dev/null 2>&1 || \
    aws iam create-role --role-name $ROLE --assume-role-policy-document file:///tmp/trust.json >/dev/null
  aws iam attach-role-policy --role-name $ROLE \
    --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
  aws iam get-instance-profile --instance-profile-name $ROLE >/dev/null 2>&1 || \
    aws iam create-instance-profile --instance-profile-name $ROLE >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name $ROLE --role-name $ROLE 2>/dev/null || true
  sleep 8   # 인스턴스 프로파일 전파 대기

  EXIST=$(aws ec2 describe-iam-instance-profile-associations --region $REGION \
    --filters "Name=instance-id,Values=$INSTANCE_ID" \
    --query "IamInstanceProfileAssociations[?State=='associated'].AssociationId" --output text)
  if [ -n "$EXIST" ] && [ "$EXIST" != "None" ]; then
    echo "이미 다른 프로파일 부착됨 → 교체:"
    aws ec2 replace-iam-instance-profile-association --region $REGION \
      --association-id $EXIST --iam-instance-profile Name=$ROLE >/dev/null \
      && echo "  교체 완료." || echo "  교체 실패 — 콘솔에서 IAM 역할 수정 권장."
  else
    aws ec2 associate-iam-instance-profile --region $REGION \
      --instance-id "$INSTANCE_ID" --iam-instance-profile Name=$ROLE >/dev/null \
      && echo "  부착 완료."
  fi

  echo "===== STEP 2: 루트 디스크 150GB(gp3) 확장 — 무중단(AWS측) ====="
  CURSIZE=$(aws ec2 describe-volumes --region $REGION --volume-ids $VOLUME_ID \
    --query "Volumes[0].Size" --output text)
  echo "  현재 ${CURSIZE}GB"
  if [ "$CURSIZE" -lt 150 ]; then
    aws ec2 modify-volume --region $REGION --volume-id $VOLUME_ID --size 150 --volume-type gp3 >/dev/null
    echo "  → 150GB/gp3 수정 요청됨 (optimizing 진행, 수분 내 완료)"
  else
    echo "  이미 150GB 이상 — 건너뜀"
  fi

  echo
  echo "✅ BLOCK A 완료(무중단). 담당자에게 이 값 전달:"
  echo "   INSTANCE_ID=$INSTANCE_ID  VOLUME_ID=$VOLUME_ID  AZ=$AZ  TYPE=$ITYPE"
  echo "   (OS 파티션 확장 resize2fs 는 담당자가 SSH로 처리)"
fi

# ─────────────────── BLOCK B (다운타임! 점검시간에만 별도 실행) ───────────────────
# ⚠️ stop/start = 라이브면 2~5분 다운 + EIP 없으면 IP 변경. 라이브면 BLOCK C 먼저.
#
# REGION=ap-northeast-2
# INSTANCE_ID=i-xxxx                 # BLOCK A 출력값
# aws ec2 stop-instances  --region $REGION --instance-ids $INSTANCE_ID
# aws ec2 wait instance-stopped --region $REGION --instance-ids $INSTANCE_ID
# aws ec2 modify-instance-attribute --region $REGION --instance-id $INSTANCE_ID \
#   --instance-type '{"Value":"t3.xlarge"}'     # 빠른빌드: c6i.2xlarge
# aws ec2 start-instances --region $REGION --instance-ids $INSTANCE_ID
# aws ec2 wait instance-running --region $REGION --instance-ids $INSTANCE_ID
# echo "타입 변경 완료 → t3.xlarge"

# ─────────────────── BLOCK C (선택: Elastic IP 고정 — 라이브 IP 보호) ───────────────────
# REGION=ap-northeast-2
# INSTANCE_ID=i-xxxx
# ALLOC=$(aws ec2 allocate-address --region $REGION --domain vpc --query AllocationId --output text)
# aws ec2 associate-address --region $REGION --instance-id $INSTANCE_ID --allocation-id $ALLOC
# NEWIP=$(aws ec2 describe-addresses --region $REGION --allocation-ids $ALLOC --query "Addresses[0].PublicIp" --output text)
# echo "새 EIP=$NEWIP  ⚠️ 라이브면 도메인 A레코드를 이 IP로 갱신 후 stop/start"
