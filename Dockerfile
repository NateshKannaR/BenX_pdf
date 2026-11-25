# syntax=docker/dockerfile:1
FROM debian:trixie-slim@sha256:ab3b3c8c5159eebfca4376430132d53c4d425f869c765ecbe47177a030da575d

# Run on linux/amd64. The date pins both direct and transitive Debian packages.
RUN rm /etc/apt/sources.list.d/debian.sources && \
    printf 'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20261124T000000Z trixie main\n' \
        > /etc/apt/sources.list && \
    apt-get -o Acquire::Retries=3 update && \
    apt-get install -y --no-install-recommends bash bzip2 ca-certificates curl e2fsprogs gcc libc6-dev \
        make python3 util-linux xz-utils && \
    rm -rf /var/lib/apt/lists/*

ARG BENX_UID=1000
ARG BENX_GID=1000
RUN groupadd --gid "${BENX_GID}" benx && \
    useradd --uid "${BENX_UID}" --gid "${BENX_GID}" --create-home benx
WORKDIR /source
USER benx
ENTRYPOINT ["./build.sh"]
CMD ["lite"]
