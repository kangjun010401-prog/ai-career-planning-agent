FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY app/frontend/package*.json ./
RUN npm ci
COPY app/frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY app/backend/requirements.txt ./app/backend/requirements.txt
RUN pip install --no-cache-dir -r app/backend/requirements.txt
COPY app/backend/ ./app/backend/
COPY app/data/ ./app/data/
COPY --from=frontend-build /build/dist ./app/frontend/dist
CMD ["sh", "-c", "uvicorn app.backend.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
