import { readFileSync } from "fs";
import * as msal from "@azure/msal-node";
import dotenv from "dotenv";

dotenv.config();

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

const elasticConfig = {
  node: process.env.ELASTIC_NODE,
  auth: {
    apiKey: {
      id: process.env.ELASTIC_NODE_API_ID,
      api_key: process.env.ELASTIC_NODE_API_KEY,
    },
  },
  tls: {
    ca: readFileSync(process.env.ELASTIC_NODE_CERTIFICATE_AUTHORITY),
    rejectUnauthorized: true,
  },
};

const config = {
  msalConfig,
  elasticConfig,
};

export default config;
