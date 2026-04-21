const serverless = require('serverless-http');
const app = require('../src/app');

// Vercel serverless function
module.exports = serverless(app);

// Local development fallback
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server is running locally on port ${PORT}`);
  });
}
