FROM alpine:3.19 AS base

RUN apk add --no-cache \
    curl \
    ca-certificates \
    bash \
    git

RUN curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 && \
    chmod 700 get_helm.sh && \
    ./get_helm.sh && \
    rm get_helm.sh

RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    chmod +x kubectl && \
    mv kubectl /usr/local/bin/

FROM base AS builder

WORKDIR /app

COPY charts/ ./charts/
COPY package.json package-lock.json* ./

RUN helm dependency update ./charts/lang-observatory
RUN helm lint ./charts/lang-observatory
RUN helm package ./charts/lang-observatory

FROM base AS runtime

WORKDIR /app

COPY --from=builder /app/*.tgz ./
COPY --from=builder /app/charts/ ./charts/

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

USER appuser

EXPOSE 8080

LABEL org.opencontainers.image.title="Lang Observatory" \
      org.opencontainers.image.description="A turnkey observability stack for large language models" \
      org.opencontainers.image.source="https://github.com/terragon-labs/lang-observatory" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.vendor="Terragon Labs"

CMD ["helm", "template", "lang-observatory", "./charts/lang-observatory"]