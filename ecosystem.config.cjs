module.exports = {
  apps: [
    {
      name: "car-mansori",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3020",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

  