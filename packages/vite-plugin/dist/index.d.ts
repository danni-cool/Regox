import type { Plugin } from 'vite';
import type { RegoxConfig } from './types.ts';
export declare function regox(config: RegoxConfig): Plugin;
export { defineConfig } from './define-config.ts';
export type { RegoxConfig };
