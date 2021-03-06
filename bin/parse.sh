#!/bin/bash
cd ${0%/*}

# Pull latest COVID stats and convert to JSON for store
# Designed to run as cron job

cd ../COVID-19-JHU/
git pull

cd ../nyc-data/repo
git pull
cd ..

cd ../parse
node population_dict.js 
node aparse.js --silent
node parse_nyc.js --silent
