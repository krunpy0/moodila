# Multi-stage Dockerfile for Moodila backend API
FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /moodila-api ./cmd/api

FROM alpine:3.21

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /moodila-api /app/moodila-api

EXPOSE 8080

ENV PORT=8080

ENTRYPOINT ["/app/moodila-api"]
