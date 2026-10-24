# syntax=docker/dockerfile:1.7
# dev-arch all-in-one image (012-install-doctor-docker): Next.js web (standalone) + engine.jar + dotnet-analyzer.
# Generic and provider-neutral: no cloud configuration, publishable to GHCR.
#
#   docker build -f docker/Dockerfile -t dev-arch .                  (from the repository root)
#   docker compose -f docker/compose.yaml up -d                      (profile "default")
#   docker compose -f docker/compose.yaml --profile dev up web-dev   (profile "dev", target "dev")
#
# Stages: engine (Maven + JDK 17) -> analyzer (.NET SDK 8) -> web (Node 20, `next build`, standalone output)
#         -> runtime (.NET 8 runtime + JRE 17 + Node 20, no SDK, non-root, HEALTHCHECK on /api/health)
#         -> dev (Node 20 + JRE 17 + .NET 8 runtime, sources mounted by compose, hot reload).

ARG NODE_IMAGE=node:20-bookworm-slim
ARG NODE_DEV_IMAGE=node:20-bookworm
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-17
ARG JRE_IMAGE=eclipse-temurin:17-jre
ARG DOTNET_SDK_IMAGE=mcr.microsoft.com/dotnet/sdk:8.0
ARG DOTNET_RUNTIME_IMAGE=mcr.microsoft.com/dotnet/runtime:8.0-bookworm-slim

# ─── 1. engine.jar ──────────────────────────────────────────────────────────────────────────────────────
FROM ${MAVEN_IMAGE} AS engine
WORKDIR /src
COPY engine/pom.xml engine/pom.xml
RUN mvn -B -q -f engine/pom.xml dependency:resolve dependency:resolve-plugins
COPY schema/1.0.0 schema/1.0.0
COPY engine/src/main engine/src/main
RUN mvn -B -f engine/pom.xml -Dmaven.test.skip=true package \
 && cp engine/target/java-dependency-extractor.jar /engine.jar

# ─── 2. dotnet-analyzer (framework-dependent, like scripts/engine-build.sh) ─────────────────────────────
FROM ${DOTNET_SDK_IMAGE} AS analyzer
ARG TARGETARCH
WORKDIR /src
COPY engine/src/main/dotnet engine/src/main/dotnet
RUN case "${TARGETARCH:-amd64}" in arm64) rid=linux-arm64 ;; *) rid=linux-x64 ;; esac \
 && dotnet publish engine/src/main/dotnet/DotNetAnalyzer/DotNetAnalyzer.csproj -c Release -r "$rid" \
      --self-contained false -o /out/dotnet-analyzer-publish \
 && printf '#!/bin/sh\nexec "$(dirname "$0")/dotnet-analyzer-publish/dotnet-analyzer" "$@"\n' > /out/dotnet-analyzer \
 && chmod +x /out/dotnet-analyzer

# ─── 3. web (Next.js standalone) ────────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS web
WORKDIR /src
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY schema/package.json schema/package.json
RUN npm ci --no-audit --no-fund
COPY schema schema
COPY web web
RUN NEXT_OUTPUT=standalone npm run build -w web \
 && cp -r web/.next/static web/.next/standalone/web/.next/static \
 && if [ -d web/public ]; then cp -r web/public web/.next/standalone/web/public; fi

# ─── 4. runtime: .NET 8 runtime + JRE 17 + Node 20, no SDK ─────────────────────────────────────────────
FROM ${JRE_IMAGE} AS jre
FROM ${NODE_IMAGE} AS node
FROM ${DOTNET_RUNTIME_IMAGE} AS runtime
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    PORT=9002 \
    HOSTNAME=0.0.0.0 \
    ENGINE_JAR_PATH=/opt/dev-arch/web/engine-dist/engine.jar \
    ARCHVIEW_DATA_DIR=/data
COPY --from=jre /opt/java/openjdk /opt/java/openjdk
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /opt/dev-arch
COPY VERSION VERSION
COPY scripts/doctor scripts/doctor
COPY --from=web /src/web/.next/standalone/ ./
COPY --from=engine /engine.jar web/engine-dist/engine.jar
COPY --from=analyzer /out/ web/engine-dist/
RUN mkdir -p /data && chown -R app:app /data
USER app
WORKDIR /opt/dev-arch/web
EXPOSE 9002
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:9002/api/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

# ─── 5. dev: sources mounted by compose (profile "dev"), hot reload ─────────────────────────────────────
FROM ${DOTNET_RUNTIME_IMAGE} AS dotnet-runtime
FROM ${NODE_DEV_IMAGE} AS dev
ENV JAVA_HOME=/opt/java/openjdk \
    PATH=/opt/java/openjdk/bin:$PATH \
    DOTNET_ROOT=/usr/share/dotnet \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    ENGINE_JAR_PATH=/opt/dev-arch/engine/engine.jar \
    ARCHVIEW_DATA_DIR=/data
COPY --from=jre /opt/java/openjdk /opt/java/openjdk
COPY --from=dotnet-runtime /usr/share/dotnet /usr/share/dotnet
COPY --from=analyzer /out/ /opt/dev-arch/engine/
RUN ln -s /usr/share/dotnet/dotnet /usr/local/bin/dotnet \
 && mkdir -p /data /app/node_modules /app/web/node_modules /app/schema/node_modules \
 && chown -R node:node /data /app /opt/dev-arch/engine
USER node
WORKDIR /app
EXPOSE 9002
# The engine jar comes from the mounted checkout (`make build-engine` on the host) and is copied next to the
# Linux dotnet-analyzer of the image, so the engine never picks up a host analyzer built for another OS.
CMD ["sh", "-c", "cp engine/target/java-dependency-extractor.jar /opt/dev-arch/engine/engine.jar && npm ci --no-audit --no-fund && npm run dev -w web"]
