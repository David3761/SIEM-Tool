FROM php:8.4-fpm

RUN useradd -ms /bin/bash -u 1000 appuser

RUN apt-get update && apt-get install -y \
    git unzip zip libicu-dev libonig-dev libzip-dev libpq-dev \
    libxml2-dev libcurl4-openssl-dev libssl-dev \
    libjpeg-dev libpng-dev libfreetype6-dev \
    && docker-php-ext-install pdo pdo_pgsql intl zip opcache

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/app