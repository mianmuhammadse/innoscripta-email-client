import express from "express";
import { getUserDetails, readEmails } from "../graph.js";
const router = express.Router();

router.get("/auth/outlook", async (req, res) => {
  const scopes =
    process.env.OAUTH_SCOPES || "https://graph.microsoft.com/.default";
  const urlParameters = {
    scopes: scopes.split(","),
    redirectUri: process.env.OAUTH_REDIRECT_URI,
  };
  try {
    const authUrl = await req.app.locals.msalClient.getAuthCodeUrl(
      urlParameters
    );

    res.redirect(authUrl);
  } catch (error) {
    console.log(error);
  }
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send("Authorization code not provided");
  }

  const scopes =
    process.env.OAUTH_SCOPES || "https://graph.microsoft.com/.default";
  const tokenRequest = {
    code,
    scopes: scopes.split(","),
    redirectUri: process.env.OAUTH_REDIRECT_URI,
  };

  try {
    const tokenResponse = await req.app.locals.msalClient.acquireTokenByCode(
      tokenRequest
    );

    req.session.userId = tokenResponse.account.homeAccountId;
    const user = await getUserDetails(
      req.app.locals.msalClient,
      req.session.userId
    );

    console.log({ session: req.session });

    req.app.locals.users[req.session.userId] = {
      displayName: user.displayName,
      email: user.email || user.userPrincipalName,
      timeZone: user.mailboxSettings.timeZone,
    };

    const emails = await readEmails(
      req.app.locals.msalClient,
      req.session.userId
    );

    // Redirect to a page to start syncing emails
    // res.redirect("/sync");
    res.status(200).send({ message: "ms oauth successful", emails });
  } catch (error) {
    console.error("Error completing authentication", error);
    res.status(500).send("Error during authentication");
  }
});

export { router };
