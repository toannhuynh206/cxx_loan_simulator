# Stage 1: Build Drogon framework
FROM ubuntu:22.04 AS drogon-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    git \
    gcc \
    g++ \
    cmake \
    libjsoncpp-dev \
    uuid-dev \
    openssl \
    libssl-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /drogon

RUN git clone https://github.com/drogonframework/drogon.git . && \
    git submodule update --init && \
    mkdir build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make -j$(nproc) && \
    make install

# Stage 2: Build application
FROM drogon-builder AS app-builder

WORKDIR /app
COPY . .

RUN mkdir -p build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release .. && \
    make -j$(nproc)

# Stage 3: Runtime
FROM ubuntu:22.04 AS runtime

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    libjsoncpp25 \
    libssl3 \
    zlib1g \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built executable and config
COPY --from=app-builder /app/build/loan_amortization_api .
COPY --from=app-builder /app/config.json .

# Create logs directory
RUN mkdir -p logs

EXPOSE 8080

CMD ["./loan_amortization_api"]
