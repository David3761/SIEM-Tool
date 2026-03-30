# Docker
build:
	docker compose up -d
	docker exec -it php composer install
	docker exec -it php php bin/console doctrine:migrations:migrate --no-interaction