require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: "info",
    service: "appeal-admin",
    message: "service_started",
    port: Number(PORT),
  }));
});
