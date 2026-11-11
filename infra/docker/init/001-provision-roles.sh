#!/bin/sh
# PostgreSQL entrypoint hook and explicit re-provisioner for an existing volume.
# Secrets are read from mounted files, passed to psql only over stdin, and never logged.
set -eu
set +x
umask 077

readonly db_user="${POSTGRES_USER:-postgres}"
readonly db_name="${POSTGRES_DB:-gd_dev}"

# Ensure every role referenced by migration 0001 exists without granting CREATEROLE to migrator.
for role in migrator importer editor api_ro; do
  psql --no-psqlrc --set ON_ERROR_STOP=1 --set role="$role" --username "$db_user" --dbname "$db_name" <<'SQL'
SELECT format('CREATE ROLE %I NOLOGIN', :'role')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role')
\gexec
SQL
done

# Drizzle creates its migration schema. CREATE SCHEMA requires database-level CREATE even when
# the target schema has already been precreated by this hook; quote the configured DB identifier.
psql --no-psqlrc --set ON_ERROR_STOP=1 --set dbname="$db_name" --username "$db_user" --dbname "$db_name" <<'SQL'
SELECT format('GRANT CREATE ON DATABASE %I TO migrator', :'dbname')
\gexec
SQL

# The first Drizzle migration runs before 0001's GRANT statements. Give migrator only the
# schema-level creation rights it needs, and make it owner of Drizzle's migration journal.
psql --no-psqlrc --set ON_ERROR_STOP=1 --username "$db_user" --dbname "$db_name" \
  --command 'GRANT USAGE, CREATE ON SCHEMA public TO migrator'
psql --no-psqlrc --set ON_ERROR_STOP=1 --username "$db_user" --dbname "$db_name" \
  --command 'CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION migrator'
psql --no-psqlrc --set ON_ERROR_STOP=1 --username "$db_user" --dbname "$db_name" \
  --command 'ALTER SCHEMA drizzle OWNER TO migrator'

provision_login() {
  role="$1"
  secret_file="/run/secrets/db_password_${role}"
  if [ ! -r "$secret_file" ]; then
    printf '%s\n' 'role provisioning failed: required secret unavailable' >&2
    exit 1
  fi

  password=''
  IFS= read -r password < "$secret_file" || [ -n "$password" ]
  case "$password" in
    ''|*[!A-Za-z0-9_-]*)
      printf '%s\n' 'role provisioning failed: invalid secret format' >&2
      exit 1
      ;;
  esac

  # Role names are fixed at the call sites. psql's \password hashes the value client-side;
  # the cleartext travels only through this pipe, never argv or a SQL file.
  psql --no-psqlrc --set ON_ERROR_STOP=1 --username "$db_user" --dbname "$db_name" \
    --command "ALTER ROLE ${role} LOGIN"
  printf '%s\n%s\n' "$password" "$password" |
    psql --no-psqlrc --set ON_ERROR_STOP=1 --username "$db_user" --dbname "$db_name" \
      --command "\\password ${role}" >/dev/null
  unset password
}

provision_login migrator
provision_login api_ro
printf '%s\n' 'role credentials provisioned'
