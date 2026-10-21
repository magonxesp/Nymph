FROM postgres:17-alpine

ARG PGVECTOR_VERSION=0.8.7

RUN apk add --no-cache --virtual .pgvector-build-deps build-base git \
    && git clone --depth 1 --branch "v${PGVECTOR_VERSION}" https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make OPTFLAGS="" with_llvm=no \
    && make install with_llvm=no \
    && cd / \
    && rm -rf /tmp/pgvector \
    && apk del .pgvector-build-deps
