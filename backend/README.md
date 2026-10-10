# CredKeep V2 Backend

This is the Django/DRF backend for CredKeep V2.

## Local Development Setup

1. **Prerequisites:** Python 3.11+, PostgreSQL 15+.
2. **Virtual Environment:**
   ```bash
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
4. **Environment Variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your local PostgreSQL credentials
   ```
5. **Database Setup:**
   Ensure PostgreSQL is running and create the database:
   ```sql
   CREATE DATABASE credkeep_v2;
   ```
6. **Migrations:**
   ```bash
   python manage.py migrate
   ```
7. **Run Server:**
   ```bash
   python manage.py runserver
   ```
8. **Run Tests:**
   ```bash
   pytest
   ```
