# ───────── build stage : gradle wrapper 로 bootJar ─────────
FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /src
COPY . .
# gradlew 가 Windows CRLF 일 수 있어 LF 로 정규화 + 실행권한
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew \
 && ./gradlew bootJar -x test --no-daemon

# ───────── runtime stage : JRE17 + Node20 + claude CLI ─────────
# Developer Studio(Claude 에이전트)가 헤드리스 `claude -p` 를 실행하므로 claude CLI 가 이미지에 있어야 한다.
# 인증은 사용자 본인 키(BYOK)를 요청 시 자식 프로세스 env(ANTHROPIC_API_KEY)로 주입 → 서버 로그인/공용키 불필요.
FROM eclipse-temurin:17-jre-jammy AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g @anthropic-ai/claude-code \
 && apt-get purge -y gnupg && apt-get autoremove -y \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Lean v2 클라우드: BE 가 EKS 로 'kubectl apply' + kubeconfig exec(aws eks get-token) 하므로
# kubectl + aws CLI 가 이미지에 있어야 한다. (LEAN_K8S_ENABLED=false 면 미사용 — 무해)
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && curl -fsSL "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" -o /usr/local/bin/kubectl \
 && chmod +x /usr/local/bin/kubectl \
 && curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip \
 && cd /tmp && unzip -q awscliv2.zip && ./aws/install && rm -rf /tmp/aws* \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# 비루트 사용자 + 쓰기 가능한 HOME(~/.claude 에 세션 transcript 저장 → --resume)
RUN useradd -m -u 1001 -d /home/app app \
 && mkdir -p /home/app/.claude /var/devbridge/uploads \
 && chown -R app:app /home/app /var/devbridge
ENV HOME=/home/app
WORKDIR /app
COPY --from=build /src/build/libs/*-SNAPSHOT.jar /app/app.jar
RUN chown -R app:app /app
USER app
EXPOSE 9091
ENTRYPOINT ["sh","-c","java -XX:MaxRAMPercentage=75 -jar /app/app.jar --spring.profiles.active=${SPRING_PROFILES_ACTIVE:-docker}"]
