-- ISO 3166-1 alpha-2 code from Cloudflare (request.cf.country); NULL when unknown
ALTER TABLE attempts ADD COLUMN country TEXT;
