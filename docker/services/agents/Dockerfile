FROM python:3.11-slim

WORKDIR /app

COPY ./services/agents/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "services/agents/main.py"]
