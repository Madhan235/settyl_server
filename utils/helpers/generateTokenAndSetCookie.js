import jwt from "jsonwebtoken";

const generateTokenAndSetCookie = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "15d",
  });

  res.cookie("jwt", token, {
    httpOnly: true,
    maxAge: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years

    sameSite: "strict", //csrf protection
  });

  return token;
};

export default generateTokenAndSetCookie;
