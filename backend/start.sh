#!/bin/sh
echo "=== Starting USPS Backend ==="
echo "DATABASE_URL is set: $(if [ -n "$DATABASE_URL" ]; then echo 'YES'; else echo 'NO'; fi)"

echo "=== Running Prisma DB Push ==="
npx prisma db push --accept-data-loss --skip-generate
PUSH_EXIT_CODE=$?

if [ $PUSH_EXIT_CODE -eq 0 ]; then
    echo "=== Prisma DB Push Successful ==="
else
    echo "=== Prisma DB Push Failed with exit code $PUSH_EXIT_CODE ==="
fi

echo "=== Starting Node Server ==="
node dist/main
