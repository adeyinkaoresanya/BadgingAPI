//SHARED
//const { findUser } = require("../../database/controllers/user.controller.js");

//const github_helpers = require("../providers/github/APICalls.js");
//const gitlab_helpers = require("../providers/gitlab/APICalls.js");
const { githubAuth, githubApp, gitlabAuth } = require("../providers/index.js");
const { handleOAuthCallback } = require("../providers/github/auth.js");
const { handleOAuthCallbackGitlab } = require("../providers/gitlab/auth.js");



//EVERYTHING AUTH AND DATABASE IS SHARED BETWEEN PROJECT AND EVENT BADGING
// THIS FILE CONTAINS BOTH THE CONTROLLERS AND ROUTES AND THIS OUGHT NOT TO BE!!!

/**
 * Redirects the user to the GitHub OAuth login page for authentication.
 * @param {*} req - object containing the client req details.
 * @param {*} res - object used to send a redirect response.
 */
const login = (req, res) => {
  const provider = req.query.provider;

  if (provider === "github") {
    githubAuth(req, res);
  } else if (provider === "gitlab") {
    gitlabAuth(req, res);
  } else {
    res.status(400).send(`Unknown provider: ${provider}`);
  }
};


// LOC 22-32 is for user's auth and is SHARED. this should be a controller and services in different files




const setUpAuthRoutes = (app) => {
  app.get("/api", (req, res) => {
    try {
      res.json({ message: "Project Badging server up and running" }); //SHARED INDEX ROUTE
    } catch (error) {
      console.error(error);

      if (error.statusCode && error.statusCode !== 200) {
        res.status(error.statusCode).json({
          error: "Error",
          message: "our bad, something is wrong with the server configuration",
        });
      } else {
        res.status(500).json({
          error: "Internal Server Error",
          message: "An unexpected error occurred at our end",
        });
      }
    }
  });

  app.get("/api/auth/github", (req, res) => { //SHARED AUTH
    githubAuth(req, res);
  });



  app.get("/api/auth/gitlab", (req, res) => { //SHARED AUTH??
    gitlabAuth(req, res);
  });
  app.get("/api/login", login); //SHARED AUTH???

  //callbacks
  app.get("/api/callback/github", handleOAuthCallback); //SHARED CALLBACKS???
  app.get("/api/callback/gitlab", handleOAuthCallbackGitlab); //SHARED CALLBACKS???

  app.post("/api/callback/github", handleOAuthCallback); //SHARED CALLBACKS???
  app.post("/api/callback/gitlab", handleOAuthCallbackGitlab);  

  app.get("*", (req, res) => { //SHARED CATCH ALL
    res.status(404).send("Endpoint not found or unresponsive");
  });
};

module.exports = {
  setUpAuthRoutes,
};




//LOC 137-206 is the route setup for both event and project badging. should be separated into route files for each feature with their own controllers and services
