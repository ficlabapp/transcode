SRV := ""

.PHONY: container
container:
	docker build -t ficlab-tc2 .

.PHONY: container-clean
container-clean:
	docker build -t ficlab-tc2 --no-cache --pull .

.PHONY: run
run:
	docker run -it --rm -p 40080:8080/tcp ficlab-tc2

.PHONY: shell
shell:
	docker run -it --rm -p 40080:8080/tcp --entrypoint bash ficlab-tc2 -l || true
