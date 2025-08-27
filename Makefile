.PHONY: help install deploy dev test
help:
@echo "Available commands:"
@echo "  make install - Install dependencies"
@echo "  make deploy  - Deploy to Cloudflare"
@echo "  make dev     - Start local development"
@echo "  make test    - Run tests"
install:
npm install
deploy:
wrangler deploy
dev:
wrangler dev
test:
./test.sh
