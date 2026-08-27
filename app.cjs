// app.cjs - Startup file for cPanel Node.js Selector (CommonJS)
console.log('--- Node.js Application Starting (CJS Mode) ---');
console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT);

try {
  // Loading the bundled server
  require('./dist/server.cjs');
  console.log('--- Server Entry Point Loaded Successfully ---');
} catch (err) {
  console.error('--- CRITICAL STARTUP ERROR ---');
  console.error(err);
  process.exit(1);
}
