const express = require("express");
const {
  createStatement, getAllStatements, getStatementsByUser, deleteStatement,
} = require("../controllers/billingController");
const { authenticate, authorize, requireSelf } = require("../middleware/auth");

const router = express.Router();

// billing_statements
router.post(  "/statements",               authenticate, authorize("admin"), createStatement);
router.get(   "/statements",               authenticate, authorize("admin"), getAllStatements);
router.get(   "/statements/user/:userId",  authenticate, requireSelf,       getStatementsByUser);
router.delete("/statements/:id",           authenticate, authorize("admin"), deleteStatement);

module.exports = router;
