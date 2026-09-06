require("dotenv").config({ quiet: true });

const app = require("./server/app");
const { PORT, HOST } = require("./server/config/env");

app.listen(PORT, HOST, () => {
  console.log(`ZDeutsch server running on http://${HOST}:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log("Docker host URL: http://zdeutsch.localhost");
});
