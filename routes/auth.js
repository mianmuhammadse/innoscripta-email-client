import express from "express";
import { hash, compare } from "bcrypt";
import jwt from "jsonwebtoken";

import { getUserDetails, readEmails } from "../graph.js";
const router = express.Router();

router.post("/signup", async (req, res) => {
  const esClient = req.app.locals.esClient;
  const { username, password } = req.body;

  const hashedPassword = await hash(password, 10);

  try {
    // Check if the users index already exists
    const indexExists = await esClient.indices.exists({ index: "users" });

    if (!indexExists) {
      // Index does not exist, create it and insert the user

      // Store the user in Elasticsearch
      // TODO! create `users` index using a script
      const response = await esClient.index({
        index: "users",
        body: {
          username,
          password: hashedPassword,
          userAccountId: "",
          displayName: "",
          email: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        refresh: true,
      });

      // Generate a JWT token
      const token = jwt.sign(
        { username, localId: response._id },
        process.env.JWT_SECRET,
        {
          expiresIn: "1h",
        }
      );

      res.status(201).send({ message: "User created successfully", token });
    } else {
      // Index exists, check the user
      const body = await esClient.search({
        index: "users",
        body: {
          query: {
            match: { username },
          },
        },
      });

      if (body && body.hits.total.value > 0) {
        res.status(409).send({ message: `${username} already exists!` });
      }
    }
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send({ error: "Error creating user" });
  }
});

router.post("/login", async (req, res) => {
  const esClient = req.app.locals.esClient;
  const { username, password } = req.body;

  try {
    // Check if the username exists
    const body = await esClient.search({
      index: "users",
      body: {
        query: {
          match: { username },
        },
      },
    });

    if (body.hits.total.value === 0) {
      return res.status(400).send({ error: "Invalid username or password" });
    }

    const user = body.hits.hits[0]._source;

    // Verify the password
    const match = await compare(password, user.password);

    if (!match) {
      return res.status(400).send({ error: "Invalid username or password" });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { username, localId: body.hits.hits[0]._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Store the token in the session
    req.session.token = token;

    res.status(200).send({ message: "Logged in successfully", token });
  } catch (error) {
    console.error("Error logging in user:", error);
    res.status(500).send({ error: "Error logging in user" });
  }
});

// outlook oAuth
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

// outlook oauth callback
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

    req.app.locals.users[req.session.userId] = {
      displayName: user.displayName,
      email: user.mail || user.userPrincipalName,
      timeZone: user.mailboxSettings.timeZone,
    };

    const esClient = req.app.locals.esClient;

    const indexExists = await esClient.indices.exists({ index: "users" });

    if (!indexExists) {
      // Index does not exist, create it and insert the user

      // TODO! create `users` index using a script
      await esClient.index({
        index: "users",
        body: {
          userAccountId: tokenResponse.account.homeAccountId,
          displayName: user.displayName,
          email: user.email || user.userPrincipalName,
        },
      });

      const emails = await readEmails(
        req.app.locals.msalClient,
        req.session.userId
      );

      // Redirect to a page to start syncing emails
      // res.redirect("/sync");
      res.status(200).send({ message: "ms oauth successful", emails });
    } else {
      // Index exists, check the user
      const body = await esClient.search({
        index: "users",
        body: {
          query: {
            match: { email: user.userPrincipalName },
          },
        },
      });

      if (body && body.hits.total.value > 0) {
        const emails = await readEmails(
          req.app.locals.msalClient,
          req.session.userId
        );

        return res.status(200).send({
          message: `ms oauth successful`,
          emails,
        });
      }
    }
  } catch (error) {
    console.error("Error completing authentication", JSON.stringify(error));
    res.status(500).send("Error during authentication");
  }
});

export { router };
