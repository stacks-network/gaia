#!/bin/bash

TASK=$1
WHICH=$(which docker)


#Prints instructions to show possible commands
instructions() {
	echo
	echo "Usage:"
	echo " To start the GAIA Hub type: $0 start."
	echo " To stop the GAIA Hub type: $0 stop."
}

#Checks if already running my containers
check_containers() {
	if [[$(docker compose -f docker-compose-base.yaml -f docker-compose-disk.yaml --env-file disk.env ps -q) ]]
		# docker running
		return 0
	fi
	# docker not running
	return 1
}

#Starts GAIA HUB
gh_start() {
	if ! check_containers; then
		echo "GAIA Hub already running. I won't do anything."
		return
	fi
	docker compose -f docker-compose-base.yaml -f docker-compose-disk.yaml --env-file disk.env up -d
	echo "GAIA HUB started."
}

#Stops GAIA HUB
gh_stop() {
	if check_containers; then
		echo "GAIA Hub is not running, so there is nothing to stop."
		return
	fi
	docker compose -f docker-compose-base.yaml -f docker-compose-disk.yaml --env-file disk.env down
	echo "GAIA HUB stopped."
}

#Starts GH, Stops GH or displays instructions.
case ${TASK} in 
	start|up)
		gh_start
		;;
	stop|down)
		gh_stop
		;;
	*)
		instructions
		;;
esac


