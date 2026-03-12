require("dotenv").config({ quiet: true });

const app = require("./server/app");
const { PORT } = require("./server/config/env");

app.listen(PORT, () => {
  console.log(`ZDeutsch server running on http://localhost:${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  console.log("Docker host URL: http://zdeutsch.localhost");
});
