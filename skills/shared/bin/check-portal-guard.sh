#!/usr/bin/env bash
# Portal guard: warns before destructive portal operations.
# Used as a PreToolUse hook on Bash, Edit, Write tools.

# Read tool input from stdin
input=$(cat)

# Extract the command (for Bash) or file_path (for Edit/Write)
command=$(echo "$input" | grep -o '"command":"[^"]*"' | sed 's/"command":"//;s/"$//' 2>/dev/null)
file_path=$(echo "$input" | grep -o '"file_path":"[^"]*"' | sed 's/"file_path":"//;s/"$//' 2>/dev/null)

# Check for destructive portal operations in bash commands
if [ -n "$command" ]; then
  case "$command" in
    *"prisma"*"migrate reset"*|*"prisma"*"db push --force"*)
      echo '{"permissionDecision":"ask","message":"⚠️ This will reset the database and destroy all portal data. Are you sure?"}'
      exit 0
      ;;
    *"rm -rf"*"app/"*|*"rm -r"*"app/"*)
      echo '{"permissionDecision":"ask","message":"⚠️ This will delete the portal application directory."}'
      exit 0
      ;;
    *"DROP TABLE"*|*"drop table"*|*"DELETE FROM"*"ClientPortal"*|*"DELETE FROM"*"Organization"*)
      echo '{"permissionDecision":"ask","message":"⚠️ This SQL command will destroy portal or organization data."}'
      exit 0
      ;;
  esac
fi

# Check for edits to sensitive files
if [ -n "$file_path" ]; then
  case "$file_path" in
    *".env"*|*"credentials"*|*"secret"*)
      echo '{"permissionDecision":"ask","message":"⚠️ Modifying credentials/secrets file. Verify this is intentional."}'
      exit 0
      ;;
    *"prisma/schema.local.prisma"*|*"prisma.config.ts"*)
      echo '{"permissionDecision":"ask","message":"⚠️ Modifying the database schema. This may require a migration."}'
      exit 0
      ;;
  esac
fi

# Allow everything else
echo '{}'
