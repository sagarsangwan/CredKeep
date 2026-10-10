# Hosting & Deployment

The initial target is a ₹0 infrastructure spend using free tiers, with a clear path to production scale.

## Infrastructure Choices
1. **Application Server (Django):** Render Free Web Service.
   - Note: Render Free spins down after 15 minutes of inactivity. The offline-first architecture of the mobile app completely masks this cold-start delay from the user, making it an ideal pairing.
2. **Database (PostgreSQL):** Neon Free Tier.
   - Offers up to 500MB storage and branching capabilities, perfect for early scaling.
3. **Static/Media Assets:** Render or local (no heavy media uploads expected initially).

## Environment Variables
The following must be configured in the hosting environment:
- `SECRET_KEY`
- `DEBUG=False`
- `ALLOWED_HOSTS`
- `DATABASE_URL` (Neon connection string)

## Deployment Process
1. Code is merged to `main`.
2. Render automatically triggers a build (via connected GitHub repo).
3. Build command: `pip install -r requirements.txt && python manage.py migrate`.
4. Start command: `gunicorn credkeep.wsgi:application`.

## Future Scaling
When limits are reached or a guaranteed SLA is required:
- Upgrade Render to a paid tier to prevent cold starts.
- Migrate Neon to a dedicated Postgres instance (e.g., AWS RDS or DigitalOcean Managed DB) if storage/compute limits are hit.
