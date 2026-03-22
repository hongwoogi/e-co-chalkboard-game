FROM nginx:alpine

# Copy game files to nginx web root
COPY . /usr/share/nginx/html/

# Custom nginx config for clean serving
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
        add_header Cache-Control "no-cache"; \
    } \
    location ~* \.(woff2|png|jpg)$ { \
        expires 1d; \
        add_header Cache-Control "public, max-age=86400"; \
    } \
    location ~* \.(css|js|svg)$ { \
        add_header Cache-Control "no-cache, must-revalidate"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
