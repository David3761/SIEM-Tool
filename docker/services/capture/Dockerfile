FROM python:3.11-slim

# Required for scapy live capture (libpcap) and network utilities
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    libpcap-dev \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY ./services/capture/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# NET_RAW + NET_ADMIN capabilities must be granted at runtime via docker-compose:
#   cap_add: [NET_RAW, NET_ADMIN]
#   network_mode: host

CMD ["python", "services/capture/sniffer.py"]
