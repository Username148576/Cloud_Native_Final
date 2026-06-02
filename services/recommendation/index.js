require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: "info",
    service: "recommendation",
    message: "service_started",
    port: Number(PORT),
  }));
});
