.PHONY: docker-image

docker-image:
	export VERSION="$$(date +%Y-%m-%d.%H%M%S)"; \
	docker build \
	-t magonx/nymph:latest \
	-t magonx/nymph:$$VERSION \
	--platform linux/amd64 . && \
	echo "builded magonx/nymph:latest, magonx/nymph:$$VERSION"
