require("dotenv").config();
const app = require("./src/app");
app.listen(process.env.PORT || 3004, () => console.log("Billing service started on 3004"));
