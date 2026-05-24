#!/bin/sh
set -e

cd /var/www/html

if [ -f composer.json ]; then
    composer install --no-interaction --quiet
fi

exec "$@"
