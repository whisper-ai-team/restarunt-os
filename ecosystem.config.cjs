module.exports = {
  apps: [
    {
      name: "webhook-server",
      script: "./server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "agent-worker",
      script: "./agent.js",
      args: "dev", // Use 'dev' or omit based on how you want to run the agent
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
