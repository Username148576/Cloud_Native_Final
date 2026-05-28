require("dotenv").config();
const app = require("./src/app");
app.listen(process.env.PORT || 3002, () => console.log("Notification Service started"));
