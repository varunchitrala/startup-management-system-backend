@echo off
echo Setting Vercel environment variables...

vercel env add DB_HOST production
echo ep-curly-feather-a1rkzxx5-pooler.ap-southeast-1.aws.neon.tech

vercel env add DB_PORT production
echo 5432

vercel env add DB_USER production
echo neondb_owner

vercel env add DB_PASSWORD production
echo npg_btV4eBAYL3If

vercel env add DB_NAME production
echo neondb

vercel env add JWT_SECRET production
echo admin123

vercel env add EMAIL_HOST production
echo smtp.gmail.com

vercel env add EMAIL_PORT production
echo 587

vercel env add EMAIL_USER production
echo varunchitralaa@gmail.com

vercel env add EMAIL_PASSWORD production
echo swyibxjcpdufttnw

vercel env add COMPANY_NAME production
echo SUN Nexus Solutions

vercel env add FRONTEND_URL production
echo https://startup-management-system-backend.vercel.app

vercel env add CRON_SECRET production
echo sunnexus_cron_secret_2026

echo Done! Now run: vercel --prod
