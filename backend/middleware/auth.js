
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify the existing JWT and load the user from MongoDB.
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    const user = await User.findById(userId).select(
      "_id name email role isEmployer"
    );

    if (!user) {
      return res.status(401).json({
        message: "User account not found.",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }
}

// Only explicitly authorized employers can access employer routes.
function requireEmployer(req, res, next) {
  if (!req.user || req.user.isEmployer !== true) {
    return res.status(403).json({
      message: "Employer access required.",
    });
  }

  return next();
}

module.exports = {
  requireAuth,
  requireEmployer,
};
