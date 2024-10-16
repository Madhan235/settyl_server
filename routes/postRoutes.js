import express from "express";
import {
  createPost,
  deletePost,
  deletePostReply,
  editPostReply,
  getFeedPosts,
  getPost,
  getUserPosts,
  likePost,
  replyToPost,
} from "../controllers/postController.js";
import { protectRoute } from "../middlewares/protectRoute.js";

const router = express.Router();

router.get("/feed", protectRoute, getFeedPosts);
router.get("/:id", getPost);
router.get("/user/:username", getUserPosts);
router.post("/create", protectRoute, createPost);
router.delete("/:id", protectRoute, deletePost);
router.put("/like/:id", protectRoute, likePost);
router.put("/reply/:id", protectRoute, replyToPost);
router.delete("/:postId/:replyId", protectRoute, deletePostReply);
router.put("/:postId/:replyId", protectRoute, editPostReply);

export default router;
