#!/bin/sh
# Load the crontab file
crontab /crontab/crontab.txt

# Start cron
cron -f
