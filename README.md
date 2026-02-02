# Compression Dictionary Transport demo

This is a small demo project to show an ability of transporting a compression dictionary over a network.

### Run via Docker

We do provide docker image ready for this demo. You can run it by following command:

```bash
docker run --rm --name cdt-demo -p 3000:3000 ghcr.io/rayriffy/compression-dictionary-demo:latest
```

As a result you should be able to access the demo at `http://localhost:3000`. Then following instructions in the browser.

### Run demo manually

Pre-bake all compressed scripts by running `bun run bake`, then start the server by running `bun run start`.
As a result you should be able to access the demo at `http://localhost:3000`. Then following instructions in the browser.
