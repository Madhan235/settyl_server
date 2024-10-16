import User from "../models/userModel.js";
import Post from "../models/postModel.js";
import bcryptjs from "bcryptjs";
import generateTokenAndSetCookie from "../utils/helpers/generateTokenAndSetCookie.js";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import { sendLikeNotificationEmail } from "../mailer.js";

export const signupUser = async (req, res, next) => {
  try {
    const { name, username, email, password } = req.body;

    const user = await User.findOne({ $or: [{ email }, { username }] });

    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = bcryptjs.hashSync(password, 10);

    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
    });

    await newUser.save();

    if (newUser) {
      generateTokenAndSetCookie(newUser._id, res);

      res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        bio: newUser.bio,
        profilePic: newUser.profilePic,
      });
    } else {
      res.status(400).json({ error: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in signupUser : ", error.message);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    // Extract email (or username) and password from request body
    const { emailOrUsername, password } = req.body;

    console.log(emailOrUsername, password);

    // Find user by either email or username
    const user = await User.findOne({
      $or: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    // Check if user exists and if the password is correct
    if (!user || !(await bcryptjs.compare(password, user.password))) {
      return res
        .status(400)
        .json({ error: "Invalid email/username or password" });
    }

    // Generate token and set cookie for the user
    generateTokenAndSetCookie(user._id, res);

    // Send user details as response
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      profilePic: user.profilePic,
    });
  } catch (error) {
    // Handle server errors
    res.status(500).json({ error: error.message });
    console.log("Error in loginUser:", error.message);
  }
};

export const OauthUser = async (req, res) => {
  try {
    const { name, username, email, profilePic } = req.body;

    const user = await User.findOne({ $or: [{ email }, { username }] });

    if (user) {
      const { password: pass, ...rest } = user._doc;
      // unFreeze
      if (user.isFrozen) {
        user.isFrozen = false;
        await user.save();
      }
      generateTokenAndSetCookie(user._id, res);
      res.status(200).json(rest);
    } else {
      //generating password

      const generatePassword =
        Math.random().toString(36).slice(-8) +
        "-" +
        Math.random().toString(36).slice(-8);

      const hashedPassword = bcryptjs.hashSync(generatePassword, 10);

      //unique username

      const newUser = new User({
        username:
          username.split(" ").join("").toLowerCase() +
          Math.random().toString(36).slice(-3),
        name,
        email,
        password: hashedPassword,
        profilePic,
      });
      await newUser.save();

      //generating token

      if (newUser) {
        generateTokenAndSetCookie(newUser._id, res);
      }

      // destructing password

      const { password: pass, ...rest } = newUser._doc;

      res.status(200).json(rest);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in OauthUser : ", error.message);
  }
};

export const logoutUser = async (req, res, next) => {
  try {
    res.cookie("jwt", "", { maxAge: 1 });
    res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in logoutUser :", error.message);
  }
};

export const followUnFollowUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userToModify = await User.findById(id);

    const currentUser = await User.findById(req.user._id);

    if (id === req.user._id.toString())
      return res
        .status(400)
        .json({ error: "You cannot follow/unfollow yourself" });

    if (!userToModify || !currentUser)
      return res.status(404).json({ error: "User not found" });

    const isFollowing = currentUser.following.includes(id);

    if (isFollowing) {
      await User.findByIdAndUpdate(id, {
        $pull: {
          followers: req.user._id,
        },
      });

      await User.findByIdAndUpdate(req.user._id, {
        $pull: {
          following: id,
        },
      });
      res
        .status(200)
        .json({ message: `${userToModify.username} unfollowed successfully` });
    } else {
      await User.findByIdAndUpdate(id, {
        $push: {
          followers: req.user._id,
        },
      });

      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          following: id,
        },
      });

      // postOwnerEmail, likedByUsername, postTitle, action;
      sendLikeNotificationEmail(
        userToModify.email,
        currentUser.username,
        "",
        "Following You"
      );

      res
        .status(200)
        .json({ message: `${userToModify.username} followed successfully` });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in followUnFollowUser :", error.message);
  }
};

export const updateUser = async (req, res, next) => {
  const { name, email, username, password, bio } = req.body;
  let { profilePic } = req.body;

  const userId = req.user._id;
  try {
    let user = await User.findById(userId);

    if (!user) return res.status(400).json({ error: "User not found" });

    if (req.params.id !== userId.toString())
      return res
        .status(400)
        .json({ error: "You can only update your profile" });

    if (password) {
      const hashedPassword = bcryptjs.hashSync(password, 10);
      user.password = hashedPassword;
    }

    if (profilePic) {
      if (user.profilePic) {
        await cloudinary.uploader.destroy(
          user.profilePic.split("/").pop().split(".")[0]
        );
      }
      const uploadResponse = await cloudinary.uploader.upload(profilePic);

      profilePic = uploadResponse.secure_url;
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.username = username || user.username;
    user.profilePic = profilePic || user.profilePic;
    user.bio = bio || user.bio;

    user = await user.save();

    await Post.updateMany(
      {
        "replies.userId": userId,
      },
      {
        $set: {
          "replies.$[reply].username": user.username,
          "replies.$[reply].userProfilePic": user.profilePic,
        },
      },
      {
        arrayFilters: [{ "reply.userId": userId }],
      }
    );

    const { password: pass, ...rest } = user._doc;
    res.status(200).json(rest);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in updateUser :", error);
  }
};

export const getUserProfile = async (req, res, next) => {
  const { query } = req.params;
  try {
    let user;

    if (mongoose.Types.ObjectId.isValid(query)) {
      user = await User.findOne({ _id: query })
        .select("-password")
        .select("-updatedAt");
    } else {
      user = await User.findOne({ username: query })
        .select("-password")
        .select("-updatedAt");
    }

    if (!user) return res.status(400).json({ error: "User not found" });

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getUser :", error.message);
  }
};

export const getSuggestedUser = async (req, res) => {
  try {
    // exclude the current user from the suggested user array , exclude users that current user is already following

    const userId = req.user._id;

    const usersFollowedByYou = await User.findById(userId).select("following");

    // aggregating in User collection and filtering the currentUser Id , and randomly fetching 10 users

    const users = await User.aggregate([
      {
        $match: {
          _id: { $ne: userId },
        },
      },
      {
        $sample: { size: 10 },
      },
    ]);

    // filtering the already followed users in the randomly aggregated users array

    const filteredUsers = users.filter(
      (user) => !usersFollowedByYou.following.includes(user._id)
    );

    // slicing the first four users

    const suggestedUsers = filteredUsers.slice(0, 4);

    suggestedUsers.forEach((user) => (user.password = null));

    res.status(200).json(suggestedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log("Error in getSuggestedUser :", error);
  }
};
