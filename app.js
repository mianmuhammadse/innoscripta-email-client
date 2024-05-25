import express from "express";
import session from "express-session";
import axios from "axios";
import querystring from "querystring";
import { config } from "dotenv";
import * as msal from "@azure/msal-node";
import syncEmails from "./sync.js";
import { router as updates } from "./updates.js";
import { router as outlookRouter } from "./routes/auth.js";
import { dirname } from "path";
import { fileURLToPath } from "url";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.locals.users = {};

const msalConfig = {
  auth: {
    clientId: process.env.OAUTH_CLIENT_ID,
    authority: process.env.OAUTH_AUTHORITY,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (!containsPii) console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    },
  },
};

app.locals.msalClient = new msal.ConfidentialClientApplication(msalConfig);

app.use(express.json());
app.use(
  session({
    secret: "your_secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(outlookRouter);

app.get("/sync", async (req, res) => {
  const accessToken = req.session.accessToken;
  const idToken = req.session.idToken;
  console.log("ACCESS_TOKEN::", accessToken);

  if (!accessToken) {
    return res.status(401).send("Not authenticated");
  }

  try {
    const userInfo = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    const userId = userInfo.data.id;

    // Sync emails
    await syncEmails(accessToken, userId);

    res.send("Emails are being synchronized");
  } catch (error) {
    console.error("Error syncing emails:", error);
    res.status(500).send("Error during email synchronization");
  }
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.use("/updates", updates);

// can be utilized inside async functions
app.all("*", (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on the server!`);
  err.status = "fails";
  err.statusCode = 404;
  next(err);
});

// global error handler
app.use((error, req, res, next) => {
  error.statusCode = error.statusCode || 500;
  error.status = error.status || "error";
  res
    .status(error.statusCode)
    .json({ status: error.errorStatus, message: error.message });
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

export { app };
