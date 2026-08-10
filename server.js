require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Payment tracker running at http://localhost:${PORT}`);
  console.log(`  Admin portal: http://localhost:${PORT}/admin`);
  console.log(`  User portal:  http://localhost:${PORT}/user`);
});
