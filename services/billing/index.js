require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: "info",
    service: "billing",
    message: "service_started",
    port: Number(PORT),
  }));
});
