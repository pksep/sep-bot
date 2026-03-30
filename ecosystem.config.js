module.exports = {
  apps: [
    {
      name: 'instance1',
      script: './dist/src/main.js',
      watch: false,
      instances: 8,
      exec_mode: 'cluster',
      node_args: '--max_old_space_size=3072',
      autorestart: true,
      max_memory_restart: '3100M',
      exp_backoff_restart_delay: 200,
      time: true,
      error_file: '/app/logs/instance1-err.log',
      out_file: '/app/logs/instance1-out.log',
      log_file: '/app/logs/instance1-combined.log',
      pid_file: '/app/logs/instance1.pid',
      env: {
        NODE_ENV: 'production',
        INIT_SEP: 'true',
        DB_POOL_LIMIT: 20,
        UV_THREADPOOL_SIZE: 16
      }
    },
    {
      name: 'instance2-test',
      script: './dist/src/main.js',
      watch: false,
      instances: 2,
      exec_mode: 'cluster',
      node_args: '--max_old_space_size=1536',
      autorestart: true,
      max_memory_restart: '1700M',
      exp_backoff_restart_delay: 150,
      time: true,
      error_file: '/app/logs/test-err.log',
      out_file: '/app/logs/test-out.log',
      log_file: '/app/logs/test-combined.log',
      pid_file: '/tmp/test-instance.pid',
      env: {
        NODE_ENV: 'production',
        INIT_SEP: 'true',
        UV_THREADPOOL_SIZE: 12,
        REDIS_URL: 'redis://redis_test:6379',
        DB_POOL_LIMIT: 12
      }
    },
    {
      name: 'instance3',
      script: './dist/src/main.js',
      watch: false,
      instances: 4,
      exec_mode: 'cluster',
      node_args: '--max_old_space_size=1536',
      autorestart: true,
      max_memory_restart: '1536M',
      exp_backoff_restart_delay: 200,
      time: true,
      error_file: '/app/logs/instance3-err.log',
      out_file: '/app/logs/instance3-out.log',
      log_file: '/app/logs/instance3-combined.log',
      pid_file: '/app/logs/instance3.pid',
      env: {
        NODE_ENV: 'production',
        INIT_SEP: 'true',
        DB_POOL_LIMIT: 20,
        UV_THREADPOOL_SIZE: 16
      }
    }
  ]
};
