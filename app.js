import express from "express";
import session from "express-session";
import axios from "axios";
import { Client } from "@elastic/elasticsearch";
import * as msal from "@azure/msal-node";
import { router as updates } from "./updates.js";
import { router as outlookRouter } from "./routes/auth.js";
import { dirname } from "path";
import { fileURLToPath } from "url";
import config from "./configs.js";
import { syncEmails } from "./graph.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.locals.users = {};

app.locals.msalClient = new msal.ConfidentialClientApplication(
  config.msalConfig
);

app.locals.esClient = new Client(config.elasticConfig);

app.use(express.json());
app.use(
  session({
    secret: "your_secret",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(outlookRouter);

app.get("/sync-emails", async (req, res) => {
  try {
    res
      .status(200)
      .json({ message: "Oauth successful andEmails sync started" });
  } catch (error) {
    res.status(500).send("Error syncing emails");
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
