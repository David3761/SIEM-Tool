FROM python:3.11-slim

WORKDIR /app

COPY ./services/rules/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./services/rules/ .

CMD ["python", "engine.py"]