
//EVENT BADGING
const eventBadging = require("../services/index.js");
const { getAllEvents } = require("../data-access/event-badging.data.js");


const { githubAuth, githubApp} = require("../../shared/providers/index.js");




//EVERYTHING AUTH AND DATABASE IS SHARED BETWEEN PROJECT AND EVENT BADGING
// THIS FILE CONTAINS BOTH THE CONTROLLERS AND ROUTES AND THIS OUGHT NOT TO BE!!!

/**
 * Redirects the user to the GitHub OAuth login page for authentication.
 * @param {*} req - object containing the client req details.
 * @param {*} res - object used to send a redirect response.
 */
const setUpEventRoutes = (app) => {
  // for event badging
  app.post("/api/auth/github", (req, res) => { // ??? EVENT_BADGING???
    githubAuth(req, res);
  });

  // github app routes
  app.post("/api/event_badging", async (req, res) => { // EVENT BADGING
    const {
      headers: { "x-github-event": name },
      body: payload,
    } = req;
    const octokit = await githubApp.getInstallationOctokit(
      payload.installation.id
    );
    eventBadging(name, octokit, payload);
    console.info(`Received ${name} event from Github`);
    res.send("ok");
  });

  // route to get all events
  app.get("/api/badged_events", getAllEvents); // EVENT BADGING

  app.get("*", (req, res) => { //SHARED CATCH ALL
    res.status(404).send("Endpoint not found or unresponsive");
  });
};

module.exports = {
  setUpEventRoutes,
};




//LOC 137-206 is the route setup for both event and project badging. should be separated into route files for each feature with their own controllers and services
