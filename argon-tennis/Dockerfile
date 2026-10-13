FROM python:3.11-slim

WORKDIR /app

COPY index.html companion.html join.html styles.css server.py ./
COPY src/ ./src/
COPY assets/ ./assets/

ENV PORT=8080
EXPOSE 8080

CMD ["python3", "server.py", "--host", "0.0.0.0", "--port", "8080"]
