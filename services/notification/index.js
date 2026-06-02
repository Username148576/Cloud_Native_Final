require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: "info",
    service: "notification",
    message: "service_started",
    port: Number(PORT),
  }));
});
