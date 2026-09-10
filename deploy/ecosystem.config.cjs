/**
 * pm2: la app de Rastro y el tunel de Cloudflare, sin sudo.
 *   pm2 start deploy/ecosystem.config.cjs && pm2 save
 * Para que arranquen al reiniciar el servidor (una vez, con sudo):
 *   pm2 startup   -> ejecuta la linea que imprime
 */
const path = require("path");
const root = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "rastro",
      cwd: root,
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      env: { NODE_ENV: "production", PORT: "3000" },
      max_memory_restart: "1G",
      time: true,
    },
    {
      name: "rastro-tunnel",
      cwd: root,
      script: "cloudflared",
      args: "tunnel --config deploy/cloudflared.yml run",
      interpreter: "none",
      time: true,
    },
  ],
};
