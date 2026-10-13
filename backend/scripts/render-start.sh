#!/bin/sh
set -eu

python manage.py verify_database_role
python manage.py verify_rls
exec gunicorn credkeep_backend.wsgi:application --bind "0.0.0.0:${PORT:-10000}"
