FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PYTHON=python3 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

RUN python3 -m venv "$VIRTUAL_ENV"
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN test -s models/realesrgan-x2.onnx \
    && test -s models/realesrgan-x4.onnx \
    && mkdir -p temp_uploads \
    && chown -R node:node /app

USER node
EXPOSE 8000

CMD ["node", "server.js"]
