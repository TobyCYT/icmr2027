# Use the lightweight Nginx Alpine image as the base
FROM nginx:alpine

# Copy all your project files into the standard Nginx HTML directory
COPY . /usr/share/nginx/html

# Expose port 80 (the default HTTP port)
EXPOSE 80
