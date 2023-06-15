FROM python:3.11-slim

COPY requirements.txt .
RUN pip install -r requirements.txt

ARG PORT
EXPOSE ${PORT}

COPY main.py .
ENV APP_PORT=${PORT}
ENTRYPOINT uvicorn main:app --host 0.0.0.0 --port ${APP_PORT}
