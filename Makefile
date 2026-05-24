# Docker
build:
	docker compose up -d --build
	docker exec -it php php bin/console doctrine:migrations:migrate --no-interaction