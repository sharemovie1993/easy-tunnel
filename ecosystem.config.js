module.exports = {
  apps: [
    {
      name: 'easy-tunnel-backend',
      script: 'backend/dist/server.js',
      cwd: __dirname,
      env: {
        PORT: 7080,
        NODE_ENV: 'production',
        LICENSE_SERVER_URL: 'https://api.absenta.id'
      },
      watch: false,
      max_restarts: 10,
      restart_delay: 3000,
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log'
    }
  ]
}
