import { createBackend } from './app.js';

const PORT = Number(process.env.PORT ?? 8787);

void createBackend()
  .listen(PORT)
  .then((port) => {
    console.log(
      `[reference-backend] listening on http://localhost:${port} and ws://localhost:${port}`
    );
  });
