.PHONY: all build test infra migrate logs stop reset clean

all: build

build:
	./dev.sh build

test:
	./dev.sh test

infra:
	./dev.sh infra

migrate:
	./dev.sh migrate

logs:
	./dev.sh logs

stop:
	./dev.sh stop

reset:
	./dev.sh reset

clean:
	rm -rf bin/
