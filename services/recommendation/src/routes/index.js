const express = require("express");
const {
  createPreferences, getPreferencesByUser, updatePreferences, deletePreferences,
  createCache, getCacheByUser, updateCache, deleteCache,
  getRecommendations, refreshCache,
} = require("../controllers/recommendationController");
const { authenticate, authorize, requireSelf } = require("../middleware/auth");

const router = express.Router();

// 核心推薦
router.get(   "/for/:userId",          authenticate, requireSelf,       getRecommendations);
router.post(  "/refresh/:userId",      authenticate, authorize("admin"), refreshCache);

// user_preferences
router.post(  "/preferences",                      authenticate, authorize("admin"), createPreferences);
router.get(   "/preferences/user/:userId",         authenticate, requireSelf,        getPreferencesByUser);
router.patch( "/preferences/:employeeId",          authenticate, authorize("admin"), updatePreferences);
router.delete("/preferences/:employeeId",          authenticate, authorize("admin"), deletePreferences);

// recommendation_cache
router.post(  "/cache",               authenticate, authorize("admin"), createCache);
router.get(   "/cache/user/:userId",  authenticate, requireSelf,        getCacheByUser);
router.patch( "/cache/:employeeId",   authenticate, authorize("admin"), updateCache);
router.delete("/cache/:employeeId",   authenticate, authorize("admin"), deleteCache);

module.exports = router;
