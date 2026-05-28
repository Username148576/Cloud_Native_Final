const express = require("express");
const {
  createAppeal, getAllAppeals, getAppealsByUser, updateAppeal, deleteAppeal,
} = require("../controllers/appealController");
const { authenticate, authorize, requireSelf } = require("../middleware/auth");

const router = express.Router();

router.post(  "/",               authenticate, authorize("admin", "employee"), createAppeal);
router.get(   "/",               authenticate, authorize("admin"),             getAllAppeals);
router.get(   "/user/:userId",   authenticate, requireSelf,                    getAppealsByUser);
router.patch( "/:id",            authenticate, authorize("admin"),             updateAppeal);
router.delete("/:id",            authenticate, authorize("admin"),             deleteAppeal);

module.exports = router;
