SRV := ""

.PHONY: container
container:
	docker build -t ficlab-transcode .

.PHONY: container-clean
container-clean:
	docker build -t ficlab-transcode --no-cache --pull .

.PHONY: run
run:
	docker run -it --rm -p 40080:8080/tcp ficlab-transcode

.PHONY: shell
shell:
	docker run -it --rm -p 40080:8080/tcp --entrypoint bash ficlab-transcode -l || true
