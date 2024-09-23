import express from "express";
import {
  searchBlogs,
  getBlogs,
  getBlog,
  createBlog,
  editBlog,
  deleteBlog,
  addBlog,
  removeBlog,
  getSavedBlogs,
  starBlog,
  unstarBlog,
  createComment,
  deleteComment,
  editComment,
  publishBlog,
  getCategories,
  getCategoryBlogs,
  getDraftedBlogs,
} from "../controllers/blogController";
import { protect } from "../middleware/authMiddleware";

const router = express.Router();

router.get("/blog", protect, getBlogs);
router.get("/search", protect, searchBlogs);
router.get("/blog/draft", protect, getDraftedBlogs);
router.get("/blog/:id", getBlog);
router.post("/blog", protect, createBlog);
router.put("/blog/:id", protect, editBlog);
router.patch("/blog/:id", protect, publishBlog);
router.delete("/blog/:id", protect, deleteBlog);

router.get("/list", protect, getSavedBlogs);
router.post("/list/blog/:id", protect, addBlog);
router.delete("/list/blog/:id", protect, removeBlog);

router.get("/category", protect, getCategories);

router.get("/blog/category/:category", protect, getCategoryBlogs);

router.post("/blog/star/:id", protect, starBlog);
router.delete("/blog/star/:id", protect, unstarBlog);

router.post("/blog/:id/comment", protect, createComment);
router.put("/blog/comment/:id", protect, editComment);
router.delete("/blog/comment/:id", protect, deleteComment);

export default router;
