require("dotenv").config();
const app = require("./src/app");
app.listen(process.env.PORT || 3003, () => console.log("Recommendation service started on 3003"));
