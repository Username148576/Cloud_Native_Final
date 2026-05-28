const express = require("express");
const {
  createNotification, getAllNotifications,
  getByUser, updateIsRead, deleteNotification,
} = require("../controllers/notificationController");
const { authenticate, authorize, requireSelf } = require("../middleware/auth");

const router = express.Router();

router.post(  "/",                        authenticate, authorize("admin", "employee", "vendor"), createNotification);
router.get(   "/",                        authenticate, authorize("admin"),                       getAllNotifications);
router.get(   "/user/:userId",            authenticate, requireSelf,                              getByUser);
router.patch( "/user/:userId/read",       authenticate, requireSelf,                              updateIsRead);
router.delete("/:id",                     authenticate, authorize("admin"),                       deleteNotification);

module.exports = router;
