#!/bin/sh
set -e

# Reconciles the container's app user with the host UID/GID Unraid (or any docker host) wants to
# own /data, then drops root before starting the app. Defaults (99/100) match Unraid's own
# nobody/users convention.
PUID="${PUID:-99}"
PGID="${PGID:-100}"

case "$PUID" in
	'' | *[!0-9]*)
		echo "entrypoint: PUID must be numeric, got '$PUID'" >&2
		exit 1
		;;
esac
case "$PGID" in
	'' | *[!0-9]*)
		echo "entrypoint: PGID must be numeric, got '$PGID'" >&2
		exit 1
		;;
esac

if [ "$(id -u)" = "0" ]; then
	if ! getent group "$PGID" >/dev/null 2>&1; then
		addgroup -g "$PGID" appgroup
	fi
	GROUP_NAME=$(getent group "$PGID" | cut -d: -f1)

	if ! getent passwd "$PUID" >/dev/null 2>&1; then
		adduser -D -H -u "$PUID" -G "$GROUP_NAME" appuser
	fi
	USER_NAME=$(getent passwd "$PUID" | cut -d: -f1)

	mkdir -p /data
	chown -R "$PUID:$PGID" /data

	exec su-exec "$PUID:$PGID" "$@"
fi

exec "$@"
