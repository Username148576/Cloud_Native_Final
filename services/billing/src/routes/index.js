const express = require("express");
const {
  createStatement, getAllStatements, getStatementsByUser, deleteStatement,
  createIncident, getAllIncidents, getIncidentsByUser, updateIncident, deleteIncident,
} = require("../controllers/billingController");
const { authenticate, authorize, requireSelf } = require("../middleware/auth");

const router = express.Router();

// billing_statements
router.post(  "/statements",               authenticate, authorize("admin"), createStatement);
router.get(   "/statements",               authenticate, authorize("admin"), getAllStatements);
router.get(   "/statements/user/:userId",  authenticate, requireSelf,       getStatementsByUser);
router.delete("/statements/:id",           authenticate, authorize("admin"), deleteStatement);

// vendor_incidents
router.post(  "/incidents",               authenticate, authorize("admin"), createIncident);
router.get(   "/incidents",               authenticate, authorize("admin"), getAllIncidents);
router.get(   "/incidents/user/:userId",  authenticate, requireSelf,       getIncidentsByUser);
router.patch( "/incidents/:id",           authenticate, authorize("admin"), updateIncident);
router.delete("/incidents/:id",           authenticate, authorize("admin"), deleteIncident);

module.exports = router;
