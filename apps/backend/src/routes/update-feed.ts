import fs from 'node:fs';
import fastifyStatic from '@fastify/static';
import type { FastifyPluginAsync } from 'fastify';

export interface UpdateFeedRoutesOptions {
  rootDirectory: string;
}

export const updateFeedRoutes: FastifyPluginAsync<UpdateFeedRoutesOptions> = async (fastify, options) => {
  // Ensure the feed directory exists
  if (!fs.existsSync(options.rootDirectory)) {
    fs.mkdirSync(options.rootDirectory, { recursive: true });
  }


  await fastify.register(fastifyStatic, {
    root: options.rootDirectory,
    prefix: '/updates/',
    decorateReply: false,
    list: false,
    index: false,
    dotfiles: 'ignore',
    redirect: false,
    setHeaders: (res, pathName) => {
      const lower = pathName.toLowerCase();
      if (lower.endsWith('.yml') || lower.endsWith('.yaml')) {
        res.header('Content-Type', 'text/yaml; charset=utf-8');
        res.header('Cache-Control', 'no-cache, must-revalidate');
      } else {
        res.header('Content-Type', 'application/octet-stream');
        res.header('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  });
};
