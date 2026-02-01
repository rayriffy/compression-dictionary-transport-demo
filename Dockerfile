FROM oven/bun AS build

WORKDIR /app

COPY package.json package.json
COPY bun.lock bun.lock

RUN bun install

COPY ./src ./src
COPY ./_three ./_three

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y curl zstd brotli

RUN bun run bake

RUN bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--outfile server \
	src/server.ts

FROM gcr.io/distroless/base

WORKDIR /app

COPY ./public ./public
COPY --from=build /app/server ./server
COPY --from=build /app/_three ./_three

ENV NODE_ENV=production

CMD ["./server"]

EXPOSE 3000