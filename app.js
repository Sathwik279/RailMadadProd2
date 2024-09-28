const { request, response } = require("express");
const express = require("express");
const app = express();

const { Issue, User } = require("./models");
const path = require("path");

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const localStrategy = require("passport-local");
const bcrypt = require("bcrypt");
const flash = require("connect-flash");
const multer = require("multer");

const { analyzeText ,getPriority} = require("./nlpUtils");
const { analyzeImage } = require("./imageUtils");
const { routeComplaint } = require("./routingLogic");

const { nanoid } = require("nanoid");

// Generate a nanoid with 10 characters

// const saltRounds = 10;
app.use(bodyParser.json()); //used to parse json data from body
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser("shh! some secret string"));
app.use(express.urlencoded({ extended: true }));
//The line app.use(express.urlencoded({ extended: true })) is middleware in an Express.js application that allows your server to parse incoming request bodies containing URL-encoded data, such as form submissions.
app.set("view engine", "ejs"); //we are not using plain html
app.set("views", path.join(__dirname, "views"));

app.use(
  session({
    secret: "my-super-secret-key 423422409284294820948204",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, //24 hrs
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new localStrategy(
    {
      usernameField: "email",
      passwordField: "password",
      passReqToCallback: true,
    },
    (req, email, password, done) => {
      const formRole = req.body.role;
      User.findOne({ where: { email: email } })
        .then(async (user) => {
          if (!user) {
            return done(null, false, { message: "User not found" });
          }

          // Check password (use bcrypt.compare if passwords are hashed)
          const isValidPassword = password === user.password;
          if (!isValidPassword) {
            return done(null, false, { message: "Invalid password" });
          }

          // Check role (assumes the role is provided in the request body)
          // Get role from DB
          if (formRole !== user.role) {
            return done(null, false, { message: "Role does not match" });
          }

          return done(null, user); // Authenticated successfully
        })
        .catch((error) => {
          return done(error);
        });
    }
  )
);

passport.serializeUser((user, done) => {
  console.log("Serializing the user in session", user.id);
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "images")); // Save in the images folder
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now(); // Unique timestamp for file names
    const userId = req.user.id; // Get the logged-in user's ID
    const fileExtension = path.extname(file.originalname); // Get file extension
    const originalName = path.basename(file.originalname, fileExtension); // Get original file name without extension
    cb(null, `${userId}-${timestamp}-${originalName}${fileExtension}`); // Store with user ID, timestamp, and original file name
  },
});

// Set up multer middleware
const upload = multer({ storage: storage });

//1.endpoint
app.get("/", async (request, response) => {
  response.render("index", {
    title: "Issue application",
  });
});

app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Signup",
  });
});

app.get("/login", (request, response) => {
  response.render("login", {
    title: "Login",
  });
});

app.get(
  "/admin",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const role = request.user.role;
    const totalIssues = await Issue.getIssues();
    const totalIssuesCount = totalIssues.length;
    const totalUncompletedIssues = totalIssues.filter((totalIssue) => {
      if (totalIssue.completed === 1) {
        return totalIssue;
      }
    });
    const totalCompletedIssues = totalIssues.filter((totalIssue) => {
      if (totalIssue.completed === 2) {
        return totalIssue;
      }
    });
    const totalUncompletedIssuesCount = totalUncompletedIssues.length;
    const totalCompletedIssuesCount = totalCompletedIssues.length;
    console.log("totalIssues", totalIssues);
    const issues = await Issue.getIssues(loggedInUser);
    const alertMessage = request.session.alertMessage || null; // Get alert message from session
    const departmentMap = await Issue.groupByDepartment();
    console.log(departmentMap);
    console.log(role);
    request.session.alertMessage = null; // Clear the message after retrieval
    // response.json(issues);
    if (request.accepts("html")) {
      response.render("./admin/admin", {
        issues,
        totalIssuesCount,
        totalUncompletedIssuesCount,
        totalCompletedIssuesCount,
        role,
        alertMessage,
        departmentMap,
      });
    } else {
      response.json({
        issues,
      });
    }
  }
);

app.get(
  "/user",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const role = request.user.role;
    const issues = await Issue.getIssues(loggedInUser);
    const allIssues = await Issue.getIssues();
    const alertMessage = request.session.alertMessage || null; // Get alert message from session
    request.session.alertMessage = null; // Clear the message after retrieval
    // response.json(issues);
    if (request.accepts("html")) {
      response.render("./user/user", {
        issues,
        allIssues,
        role,
        alertMessage,
      });
    } else {
      response.json({
        issues,
      });
    }
  }
);
app.get(
  "/user/submitIssue",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    response.render("user/submitIssue");
  }
);
app.get(
  "/user/issueStatus",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const loggedInUser = request.user.id;
    const role = request.user.role;
    const issues = await Issue.getIssues(loggedInUser);
    const allIssues = await Issue.getIssues();
    const alertMessage = request.session.alertMessage || null; // Get alert message from session
    request.session.alertMessage = null; // Clear the message after retrieval
    // response.json(issues);
    if (request.accepts("html")) {
      response.render("user/issueStatus", {
        issues,
        allIssues,
        role,
        alertMessage,
      });
    } else {
      response.json({
        issues,
      });
    }
  }
);
app.get(
  "/user/aiChatbot",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    response.render("user/aiChatbot");
  }
);
app.get(
  "/user/feedback",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    const allIssues = await Issue.getIssues();
    const completedIssues = allIssues.filter((issue) => issue.completed === 2);
    response.render("user/feedback", {
      completedIssues,
    });
  }
);

app.get("/signout", (request, response, next) => {
  //signout
  request.logout((err) => {
    if (err) {
      return;
    }
    response.redirect("/");
  });
});

app.post(
  "/issues",
  connectEnsureLogin.ensureLoggedIn(),
  upload.array("media", 10), // Allow up to 10 files (regardless of type)

  async (request, response) => {
    try {
      console.log("Creating a todo", request.body);
      console.log(request.user);

      const title = request.body.title;
      const desc = request.body.desc;
      const urgency = getPriority(desc);
      const files = request.files; // Get uploaded files
      const mediaType = request.body.mediaType; // Get selected media type

      let category = "";
      if (desc) {
        category = await analyzeText(desc); // Use the description for analysis
      }

      if (files && files.length > 0) {
        let mediaCategory = "";

        if (mediaType === "image") {
          // Analyze the first image file
          mediaCategory = await analyzeImage(files[0].path);
        }
        //else if (mediaType === "audio") {
        //   // Optionally analyze audio files
        //   mediaCategory = await analyzeAudio(files[0].path);
        // } else if (mediaType === "video") {
        //   // Optionally analyze video files
        //   mediaCategory = await analyzeVideo(files[0].path);
        // }

        if (mediaCategory) {
          category = mediaCategory;
        }
      }

      console.log("category", category);
      const department = routeComplaint(category);
      console.log("department", department);

      console.log("received files", files);
      const uploadedFilePaths = files.map((file) => file.path);

      console.log("uploadedFilePaths", uploadedFilePaths);
      const loggedInUser = request.user.id;
      const secId = nanoid(4); // Generates a random UUID
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed, so we add 1
      const day = String(today.getDate()).padStart(2, "0"); // Adds leading zero for single-digit days
      const dateNum = `${year}${month}${day}`;

      const dateString = `${year}${month}${day}`;
      console.log(dateString); // Example output: "20240928"

      const issue = await Issue.addIssue(
        dateNum,
        secId,
        request,
        response,
        loggedInUser,
        uploadedFilePaths,
        category,
        department,
        urgency
      );
      request.session.alertMessage = `issue created Department:${department}  ID:${issue.id}`;
      response.redirect("user/issueStatus");
    } catch (error) {
      console.error("Error adding issue:", error);
      response.status(500).send("Error creating issue");
    }
  }
);

app.post("/users", async (request, response) => {
  try {
    const user = await User.addUser(request, response);
    if (user.role === "admin") response.redirect("/admin");
    else {
      response.redirect("/user");
    }
  } catch (error) {
    console.log(error);
  }
  // response.json(user);
});

app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
  }),
  (request, response) => {
    if (request.body.role === "admin") {
      response.redirect("/admin");
    } else {
      response.redirect("/user");
    }
  }
);

app.post("/issues/feedback", async (request, response) => {
  const { idVal, feedback } = request.body;
  console.log("idval", idVal, "feed", feedback);
  if (!idVal || !feedback) {
    return response
      .status(422)
      .json({ message: "Please provide both id and feedback" });
  }
  const updatedIssue = await Issue.setFeedBack(idVal, feedback);
  return response.redirect("/user/feedback");
});

app.put("/issues/:id", async (request, response) => {
  try {
    if (request.body.status === "updateStatus") {
      const updatedIssue = await Issue.setCompletionStatus(request.params.id);
      return response.json(updatedIssue);
    }
  } catch (error) {
    return response.status(422).json(error);
  }
});

app.delete(
  "/issues/:id",

  async (request, response) => {
    console.log("Delete a Issue by ID:", request.params.id);

    try {
      console.log("before Issue");
      const issue = await Issue.findByPk(request.params.id);
      console.log(issue);
      console.log("after Issue");
      if (!Issue) {
        return res
          .status(404)
          .json({ success: false, message: "Issue not found" });
      }

      await Issue.remove(request.params.id);
      console.log({ success: true });
      return response.json({ success: true });
    } catch (error) {
      return response.status(422).json(error);
    }
  }
);

app.delete("/users/:id", async (request, response) => {
  console.log("Delete a User by ID:", request.params.id);

  try {
    console.log("before User");
    const user = await User.findByPk(request.params.id);
    console.log(user);
    console.log("after User");
    if (!User) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    await User.remove(request.params.id);
    console.log({ success: true });
    return response.json({ success: true });
  } catch (error) {
    return response.status(422).json(error);
  }
});

module.exports = app;
