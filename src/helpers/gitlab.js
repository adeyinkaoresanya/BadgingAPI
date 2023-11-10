const axios = require("axios");
const Repo = require("../../database/models/repo.model.js");
const bronzeBadge = require("../badges/bronzeBadge.js");
const mailer = require("../helpers/mailer.js");

/**
 * Starts the authorization process with the GitLab OAuth system
 * @param {*} res Response to send back to the caller
 */
const authorizeApplication = (res) => {
  if (!process.env.GITLAB_APP_CLIENT_ID) {
    res.status(500).send("GitLab provider is not configured");
    return;
  }

  const scopes = ["read_api"];
  const url = `https://gitlab.com/oauth/authorize?client_id=${
    process.env.GITLAB_APP_CLIENT_ID
  }&response_type=code&state=STATE&scope=${scopes.join("+")}&redirect_uri=${
    process.env.GITLAB_APP_REDIRECT_URI
  }`;

  res.redirect(url);
};

/**
 * Calls the GitLab API to get an access token from the OAuth code.
 * @param {*} code Code returned by the GitLab OAuth authorization API
 * @returns A json object with `access_token` and `errors`
 */
const requestAccessToken = async (code) => {
  try {
    const {
      data: { access_token },
    } = await axios.post(
      "https://gitlab.com/oauth/token",
      {
        client_id: process.env.GITLAB_APP_CLIENT_ID,
        client_secret: process.env.GITLAB_APP_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.GITLAB_APP_REDIRECT_URI,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    return {
      access_token,
      errors: [],
    };
  } catch (error) {
    return {
      access_token: "",
      errors: [error.message],
    };
  }
};

/**
 * Calls the GitLab API to get the user info.
 * @param {*} access_token Token used to authorize the call to the GitLab API
 * @returns A json object with `user_info` and `errors`
 */
const getUserInfo = async (access_token) => {
  try {
    // Authenticated user details
    const {
      data: { username: login, name, email, id },
    } = await axios.get("https://gitlab.com/api/v4/user", {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${access_token}`,
      },
    });

    return {
      user_info: {
        login,
        name,
        email,
        id,
      },
      errors: [],
    };
  } catch (error) {
    return {
      user_info: null,
      errors: [error.message],
    };
  }
};

/**
 * Calls the GitLab API to get the user public repositories.
 * @param {*} access_token Token used to authorize the call to the GitLab API
 * @returns A json object with `repositories` and `errors`
 */
const getUserRepositories = async (access_token) => {
  try {
    // Authenticated user details
    const { data } = await axios.get(
      "https://gitlab.com/api/v4/projects?owned=true&visibility=public",
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    return {
      repositories: data.map((repo) => {
        return {
          id: repo.id,
          fullName: repo.name_with_namespace,
        };
      }),
      errors: [],
    };
  } catch (error) {
    return {
      repositories: null,
      errors: [error.message],
    };
  }
};

/**
 * Get the id and url of the provided repository path
 * @param {*} repositoryId The id of the repository
 * @returns A json object with `info` (the repository infos) and `errors`
 */
const getRepositoryInfo = async (repositoryId) => {
  try {
    const { data } = await axios.get(
      `https://gitlab.com/api/v4/projects/${repositoryId}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    return {
      info: {
        id: repositoryId,
        url: data.web_url,
        defaultBranch: data.default_branch,
      },
      errors: [],
    };
  } catch (error) {
    return {
      info: null,
      errors: [error.message],
    };
  }
};

/**
 * Get the content and commit SHA of a file inside a repository
 * @param {*} repositoryId The path to the repository, without the owner prefix
 * @param {*} filePath The path to the file inside the repository
 * @param {*} branch Name of the branch to use as source for the file
 * @returns A json object with `file` (SHA and content) and `errors`
 */
const getFileContentAndSHA = async (repositoryId, filePath, branch) => {
  try {
    const { data } = await axios.get(
      `https://gitlab.com/api/v4/projects/${repositoryId}/repository/files/${filePath}?ref=${branch}`,
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    return {
      file: {
        sha: data.last_commit_id,
        content: Buffer.from(data.content, "base64").toString(),
      },
      errors: [],
    };
  } catch (error) {
    return {
      file: null,
      errors: [error.message],
    };
  }
};

/**
 * Scans a list of repositories to try and apply for a badge
 * @param {*} userId Id of the user
 * @param {*} name Full name of the user
 * @param {*} email User email used to send them emails with the results
 * @param {*} repositoryIds List of repositories id to scan
 */
const scanRepositories = async (userId, name, email, repositoryIds) => {
  let results = [];

  try {
    for (const repositoryId of repositoryIds) {
      const { info, errors: info_errors } = await getRepositoryInfo(
        repositoryId
      );
      if (info_errors.length > 0) {
        console.error(info_errors);
        continue;
      }

      const { file, errors: file_errors } = await getFileContentAndSHA(
        repositoryId,
        "DEI.md",
        info.defaultBranch
      );
      if (file_errors.length > 0) {
        results.push(`${info.url} does not have a DEI.md file`);
        continue;
      }

      try {
        // Check if the repo was badged before
        const existingRepo = await Repo.findOne({
          where: { gitlabRepoId: info.id, DEICommitSHA: file.sha },
        });

        if (file.content) {
          if (existingRepo) {
            // Compare the DEICommitSHA with the existing repo's DEICommitSHA
            if (existingRepo.DEICommitSHA !== file.sha) {
              bronzeBadge(
                userId,
                name,
                email,
                null,
                info.id,
                info.url,
                file.content,
                file.sha
              );
            } else {
              // Handle case when DEI.md file is not changed
              results.push(`${info.url} was already badged`);
            }
          } else {
            // Repo not badged before, badge it
            bronzeBadge(
              userId,
              name,
              email,
              null,
              info.id,
              info.url,
              file.content,
              file.sha
            );
          }
        }
      } catch (error) {
        console.error(error.message);
      }
    }

    // Send one single email for generic errors while processing repositories
    // The `bronzeBadge` function will handle sending email for each project
    // with wether success or error messages
    if (results.length > 0) {
      mailer(email, name, "Bronze", null, null, results.join("\n"));
    }
  } catch (error) {
    console.error("Error: ", error.message);
  }

  return results;
};

module.exports = {
  authorizeApplication,
  requestAccessToken,
  getUserInfo,
  getUserRepositories,
  scanRepositories,
};
