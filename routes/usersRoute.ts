import express from "express";
import {
  activateAccount,
  registerUser,
  loginUser,
  getUser,
  addCategories,
  getNotifications,
  markNotificationsAsSeen,
  followUser,
  unFollowUser,
  getProfile,
  recentSearches,
  deleteSearch,
  editUser,
  authorizeUserWithProvider,
  resetPasswordRequest,
  resetAccountPassword,
  sendAccountDeleteEmail,
  deleteUser,
  getUserCategories,
  getWhoToFollow,
} from "../controllers/userController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/register", registerUser);
router.post("/oauth", authorizeUserWithProvider);
router.post("/login", loginUser);

router.post("/user/reset-password", resetPasswordRequest);
router.post("/user/reset-password/:token", resetAccountPassword);

router.post("/activate/:token", activateAccount);
router.post("/user/category", protect, addCategories);
router.get("/me", protect, getUser);
router.put("/user", protect, editUser);
router.delete("/user", protect, sendAccountDeleteEmail);
router.get("/user/follow", protect, getWhoToFollow);
router.delete("/user/:token", protect, deleteUser);

router.get("/user/categories", protect, getUserCategories);
router.get("/user/:username", protect, getProfile);

router.get("/search/recent", protect, recentSearches);
router.delete("/search/:id", protect, deleteSearch);

router.post("/follow/:username", protect, followUser);
router.delete("/follow/:username", protect, unFollowUser);

router.get("/notification", protect, getNotifications);
router.patch("/notification", protect, markNotificationsAsSeen);

export default router;
