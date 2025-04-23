FROM python:3.11-slim

# Create working directory
WORKDIR /app

# Install cron
RUN apt-get update && apt-get install -y cron

# Copy crontab and entrypoint
COPY crontab/ /crontab/

# Add your scripts volume mount path
VOLUME ["/app/scripts"]

# Copy env if needed
COPY .env .env

# Entrypoint
COPY crontab/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
