const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Check if certificates exist
const certPath = path.join(__dirname, '../certificates/localhost-cert.pem');
const keyPath = path.join(__dirname, '../certificates/localhost-key.pem');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('❌ SSL certificates not found. Please run the certificate generation script first.');
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Please stop the other server first.`);
        process.exit(1);
      }
      throw err;
    }
    console.log(`🔒 HTTPS Development Server ready on https://localhost:${port}`);
    console.log('📝 Note: You may need to accept the self-signed certificate in your browser');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use. Please stop the other server first.`);
      process.exit(1);
    }
    console.error('❌ Server error:', err);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down HTTPS server...');
    server.close(() => {
      console.log('✅ HTTPS server closed');
      process.exit(0);
    });
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down HTTPS server...');
    server.close(() => {
      console.log('✅ HTTPS server closed');
      process.exit(0);
    });
  });
}); 