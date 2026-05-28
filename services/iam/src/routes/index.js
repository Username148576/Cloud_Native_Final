const express = require("express");
const { login, verifyEmail } = require("../controllers/authController");
const {
  createUser, getAllUsers, getUserById,
  updatePassword, requestEmailUpdate, deleteUser,
} = require("../controllers/userController");
const {
  createEmployee, getAllEmployees, getEmployeeByUser,
  updateEmployee, updatePhone, deleteEmployee,
} = require("../controllers/employeeController");
const { authenticate, authorize, requireSelf } = require("../middleware/auth");

const router = express.Router();

// ── Auth ─────────────────────────────────────────────────────
router.post("/auth/login", login);
router.get("/auth/verify-email", verifyEmail); // 驗證信連結

// ── Users ────────────────────────────────────────────────────
router.post(  "/users",                    authenticate, authorize("admin"),     createUser);
router.get(   "/users",                    authenticate, authorize("admin"),     getAllUsers);
router.get(   "/users/:userId",            authenticate, requireSelf,            getUserById);
router.patch( "/users/:userId/password",   authenticate, requireSelf,            updatePassword);
router.patch( "/users/:userId/email",      authenticate, requireSelf,            requestEmailUpdate);
router.delete("/users/:userId",            authenticate, authorize("admin"),     deleteUser);

// ── Employees ─────────────────────────────────────────────────
router.post(  "/employees",                    authenticate, authorize("admin"),              createEmployee);
router.get(   "/employees",                    authenticate, authorize("admin"),              getAllEmployees);
router.get(   "/employees/user/:userId",       authenticate, requireSelf,                    getEmployeeByUser);
router.patch( "/employees/:id",                authenticate, authorize("admin"),              updateEmployee);
router.patch( "/employees/user/:userId/phone", authenticate, requireSelf,                    updatePhone);
router.delete("/employees/:id",                authenticate, authorize("admin"),              deleteEmployee);

module.exports = router;
