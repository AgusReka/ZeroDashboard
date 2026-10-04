import { ejecutarAgente } from './arranque.js';

// CH-19c2 (DEC-120, DEC-123): the agent image's entrypoint. Exit codes live in `arranque.ts`.
ejecutarAgente({ env: process.env, proceso: process });
