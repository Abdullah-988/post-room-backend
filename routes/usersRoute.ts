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
  registerUserWithProvider,
} from "../controllers/userController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.post("/register", registerUser);
router.post("/register/oauth", registerUserWithProvider);
router.post("/login", loginUser);
router.post("/activate/:token", activateAccount);
router.post("/user/category", protect, addCategories);
router.get("/me", protect, getUser);
router.put("/user", protect, editUser);

router.get("/user/:username", protect, getProfile);

router.get("/search/recent", protect, recentSearches);
router.delete("/search/:id", protect, deleteSearch);

router.post("/follow/:username", protect, followUser);
router.delete("/follow/:username", protect, unFollowUser);

router.get("/notification", protect, getNotifications);
router.patch("/notification", protect, markNotificationsAsSeen);

export default router;
