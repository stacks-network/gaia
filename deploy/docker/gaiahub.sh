#!/bin/bash

TASK=$1
WHICH=$(which docker)
SCRIPTPATH=$(pwd -P)
FILE1="docker-compose-base.yaml"
FILE2="docker-compose-disk.yaml"
FILE3="disk.env"

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
	if ! test -f "$FILE1"; then 
		echo "Missing $FILE1. Did you delete it?"
		return 0
	fi
	if ! test -f "$FILE2"; then
		echo "Missing $FILE2. Did you delete it?"
		return 0
	fi
	if ! test -f "$FILE3"; then
		echo "Missing $FILE3. Looks like you forgot to create one."
		return 0
	fi
	# If all files I need exist, then continue
	return 1
}

#Checks if already running my containers
check_containers() {
	if [[ $(docker compose -f ${SCRIPTPATH}/${FILE1} -f ${SCRIPTPATH}/${FILE2} --env-file $SCRIPTPATH{}/${FILE3} ps -q) ]];
	then
		# docker running
		return 0
	fi
	# docker not running
	return 1
}

gh_status() {
	if ! check_containers; then
		echo "GAIA HUB running."
		return
	fi
	if check_containers; then
		echo "GAIA HUB not running."
		return
	fi
}

#Starts GAIA HUB
gh_start() {
	if ! check_containers; then
		echo "GAIA Hub already running. I won't do anything."
		return
	fi
	docker compose -f ${SCRIPTPATH}/docker-compose-base.yaml -f ${SCRIPTPATH}/docker-compose-disk.yaml --env-file ${SCRIPTPATH}/disk.env up -d
	echo "GAIA HUB started."
}

#Stops GAIA HUB
gh_stop() {
	if check_containers; then
		echo "GAIA Hub is not running, so there is nothing to stop."
		return
	fi
	docker compose -f ${SCRIPTPATH}/docker-compose-base.yaml -f ${SCRIPTPATH}/docker-compose-disk.yaml --env-file ${SCRIPTPATH}/disk.env down
	echo "GAIA HUB stopped."
}

#Starts GH, Stops GH or displays instructions.
case ${TASK} in 
	start|up)
		if ! check_files_exist; then
			gh_start
		fi
		;;
	stop|down)
		if ! check_files_exist; then
			gh_stop
		fi
		;;
	status)
		if ! check_files_exist; then
			gh_status
		fi
		;;
	*)
		instructions
		;;
esac
