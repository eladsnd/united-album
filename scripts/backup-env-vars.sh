#!/bin/bash

# Backup Vercel Environment Variables
# Run this script to save your environment variables to a local backup file

BACKUP_DIR="$HOME/.wedding-app-backups"
BACKUP_FILE="$BACKUP_DIR/env-backup-$(date +%Y%m%d-%H%M%S).txt"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "🔐 Backing up environment variables from .env.local..."

# Copy .env.local to backup (excluding VERCEL_TOKEN)
cat .env.local | grep -v VERCEL_TOKEN > "$BACKUP_FILE"

echo "✅ Backup saved to: $BACKUP_FILE"
echo ""
echo "📋 Environment variables backed up:"
cat "$BACKUP_FILE" | grep -E "^[A-Z_]+" | sed 's/=.*/=***/'
echo ""
echo "💡 Keep this file safe! You'll need it to restore env vars in Vercel if they get deleted."
