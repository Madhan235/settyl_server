import User from "../models/userModel.js";
import Post from "../models/postModel.js";
import { v2 as cloudinary } from "cloudinary";
import { sendLikeNotificationEmail } from "../mailer.js";
import { truncateText } from "../utils/helpers/truncate.js";

export const createPost = async (req, res, next) => {
  try {
    const { postedBy, text } = req.body;
    let { img } = req.body;

    if (!postedBy || !text) {
      return res
        .status(400)
        .json({ error: "PostedBy and text fields are required" });
    }

    const user = await User.findById(postedBy);

    if (!user) return res.status(404).json({ error: "User not found" });

    if (user._id.toString() !== req.user._id.toString())
      return res.status(401).json({ error: "Unathorized to create post" });

    const maxLength = 500;

    if (text.length > maxLength)
      return res
        .status(400)
        .json({ error: `Text must be less than ${maxLength} characters` });

    if (img) {
      const uploadResponse = await cloudinary.uploader.upload(img);
      img = uploadResponse.secure_url;
    }

    const newPost = new Post({ postedBy, text, img });

    await newPost.save();

    res.status(201).json(newPost);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in createPost :", error.message);
  }
};

export const getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).json({ error: "Post not found" });

    res.status(200).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getPost :", error.message);
  }
};

export const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.postedBy.toString() !== req.user._id.toString()) {
      return res.status(401).json({ error: "You can delete only your post" });
    }

    if (post.img) {
      const imgId = post.img.split("/").pop().split(".")[0];

      await cloudinary.uploader.destroy(imgId);
    }

    await Post.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in  deletePost :", error.message);
  }
};

export const likePost = async (req, res, next) => {
  try {
    const { id: postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    const postCreater = await User.findById(post.postedBy);

    const postlikedBy = await User.findById(userId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const userLikedPost = post.likes.includes(userId);

    if (userLikedPost) {
      await Post.updateOne(
        { _id: postId },
        {
          $pull: {
            likes: userId,
          },
        }
      );
      res.status(200).json({ message: "Post unliked successfully" });
    } else {
      post.likes.push(userId);

      // postOwnerEmail, likedByUsername, postTitle, action;
      if (post.text.length > 15) {
        post.text = truncateText(post.text, 15);
      }

      sendLikeNotificationEmail(
        postCreater.email,
        postlikedBy.username,
        post.text,
        "Liked"
      );

      await post.save();

      res.status(200).json({ message: "Post liked successfully" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in likePost :", error.message);
  }
};

export const replyToPost = async (req, res, next) => {
  try {
    // comes from body
    const { text } = req.body;

    // comes from url
    const postId = req.params.id;
    // comes from middleware

    const userId = req.user._id;
    const userPorfilePic = req.user.profilePic;

    const username = req.user.username;

    if (!text)
      return res.status(400).json({
        error: "Text field is required",
      });

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const reply = { userId, text, userPorfilePic, username };

    const postCreater = await User.findById(post.postedBy);

    post.replies.push(reply);

    if (post.text.length > 15) {
      post.text = truncateText(post.text, 15);
    }

    sendLikeNotificationEmail(
      postCreater.email,
      username,
      post.text,
      "Commented"
    );
    await post.save();

    res.status(200).json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in replyPost :", error.message);
  }
};

export const getFeedPosts = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const following = user.following;

    const feedPosts = await Post.find({ postedBy: { $in: following } }).sort({
      createdAt: -1,
    });

    res.status(200).json(feedPosts);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getFeedPosts :", error.message);
  }
};

export const getUserPosts = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not Found" });
    }

    const posts = await Post.find({ postedBy: user._id }).sort({
      createdAt: -1,
    });

    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getUserPosts :", error.message);
  }
};

export const deletePostReply = async (req, res) => {
  try {
    const { postId, replyId } = req.params;

    // Find the post by ID
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Remove the reply from the replies array
    post.replies = post.replies.filter(
      (reply) => reply._id.toString() !== replyId
    );

    // Save the updated post
    await post.save();

    res.status(200).json("Reply deleted successfully");
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in deletePostReply :", error.message);
  }
};

export const editPostReply = async (req, res) => {
  try {
    const { postId, replyId } = req.params;

    const { updateReply } = req.body;

    // Find the post by ID
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Find and update the specific reply's text
    const replyIndex = post.replies.findIndex(
      (reply) => reply._id.toString() === replyId
    );

    if (replyIndex === -1) {
      return res.status(404).json({ error: "Reply not found" });
    }

    post.replies[replyIndex].text = updateReply;
    if (!post.replies[replyIndex].isEdited) {
      post.replies[replyIndex].isEdited = true;
    }

    await post.save();
    res.status(200).json("Comment updated successfully");
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in editPostReply :", error.message);
  }
};
