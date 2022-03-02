#!/bin/bash
# Enable exit on error
set -uo pipefail

TASK="$1"
SCRIPTPATH=$(pwd -P)
FILE_BASE="docker-compose-base.yaml"
FILE_DISK="docker-compose-disk.yaml"
FILE_ENV="disk.env"

#Prints instructions to show possible commands
instructions() {
	echo
	echo "Usage:"
	echo " To start the GAIA Hub type: $0 start."
	echo " To stop the GAIA Hub type: $0 stop."
	echo " To check if GAIA Hub is running type: $0 status."
	echo " Simply typing $0 displays this help message."
	echo
}

#Checks files I need exist
check_files_exist() {
	# If a file I need is missing, inform the user.
	if ! [ -f "$FILE_BASE" ]; then
		echo "Missing $FILE_BASE. Did you delete it?" >&2
		return 1
	fi
	if ! [ -f "$FILE_DISK" ]; then
		echo "Missing $FILE_DISK. Did you delete it?" >&2
		return 1
	fi
	if ! [ -f "$FILE_ENV" ]; then
		echo "Missing $FILE_ENV. Looks like you forgot to create one." >&2
		return 1
	fi
	# If all files I need exist, then continue
	return 0
}

#Checks if already running my containers
check_containers() {
	if [[ $(docker compose -f "${SCRIPTPATH}"/"${FILE_BASE}" -f "${SCRIPTPATH}"/"${FILE_DISK}" --env-file "${SCRIPTPATH}"/"${FILE_ENV}" ps -q) ]];
	then
		# docker running
		return 0
	fi
	# docker not running
	return 1
}

gh_status() {
	if check_containers; then
		echo "GAIA HUB running."
		return 1
	fi
	echo "GAIA HUB not running."
	return 0
}

#Starts GAIA HUB
gh_start() {
	if check_containers; then
		echo "GAIA Hub already running. I won't do anything."
		return
	fi
	docker compose -f "${SCRIPTPATH}"/"${FILE_BASE}" -f "${SCRIPTPATH}"/"${FILE_DISK}" --env-file "${SCRIPTPATH}"/"${FILE_ENV}" up -d
	echo "GAIA HUB started."
}

#Stops GAIA HUB
gh_stop() {
	if ! check_containers; then
		echo "GAIA Hub is not running, so there is nothing to stop."
		return
	fi
	docker compose -f "${SCRIPTPATH}"/"${FILE_BASE}" -f "${SCRIPTPATH}"/"${FILE_DISK}" --env-file "${SCRIPTPATH}"/"${FILE_ENV}" down
	echo "GAIA HUB stopped."
}

#Exit on error if the programs I need are not found
exit_error() {
   printf "%s" "$1" >&2
   exit 1
}

for cmd in grep docker; do
   command -v "$cmd" >/dev/null 2>&1 || exit_error "Missing command: $cmd"
done

#Starts GH, Stops GH or displays instructions.
#Will only execute the start, stop and status if the files I need exist. If they don't it will display a warning.
case ${TASK} in 
	start|up)
		if check_files_exist; then
			echo "will start"
			gh_start
		fi
		;;
	stop|down)
		if check_files_exist; then
			gh_stop
		fi
		;;
	status)
		if check_files_exist; then
			gh_status
		fi
		;;
	*)
		instructions
		;;
esac
