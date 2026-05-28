require("dotenv").config();
const app = require("./src/app");
app.listen(process.env.PORT || 3005, () => console.log("Appeal-Admin service started on 3005"));
