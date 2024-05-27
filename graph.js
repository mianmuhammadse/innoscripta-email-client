import { Client } from "@microsoft/microsoft-graph-client";
import { dirname } from "path";
import { fileURLToPath } from "url";
import path from "path";
import { writeFileSync, existsSync, readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getAuthenticatedClient(msalClient, userId) {
  if (!msalClient || !userId) {
    throw new Error(
      `Invalid MSAL state. Client: ${
        msalClient ? "present" : "missing"
      }, User ID: ${userId ? "present" : "missing"}`
    );
  }

  // Initialize Graph client
  const client = Client.init({
    // Implement an auth provider that gets a token
    // from the app's MSAL instance
    authProvider: async (done) => {
      try {
        // Get the user's account
        const account = await msalClient
          .getTokenCache()
          .getAccountByHomeId(userId);

        if (account) {
          // Attempt to get the token silently
          // This method uses the token cache and
          // refreshes expired tokens as needed
          const scopes =
            process.env.OAUTH_SCOPES || "https://graph.microsoft.com/.default";
          const response = await msalClient.acquireTokenSilent({
            scopes: scopes.split(","),
            redirectUri: process.env.OAUTH_REDIRECT_URI,
            account: account,
          });

          // First param to callback is the error,
          // Set to null in success case
          done(null, response.accessToken);
        }
      } catch (err) {
        console.log(JSON.stringify(err, Object.getOwnPropertyNames(err)));
        done(err, null);
      }
    },
  });

  return client;
}

async function getUserDetails(msalClient, userId) {
  const client = getAuthenticatedClient(msalClient, userId);

  const user = await client
    .api("/me")
    .select("displayName,mail,mailboxSettings,userPrincipalName")
    .get();

  return user;
}

async function loadExistingEmails() {
  const filePath = path.join(__dirname, "emails.json");
  if (existsSync(filePath)) {
    const data = JSON.parse(readFileSync(filePath));
    return data;
  }
  return { emails: [], deltaLink: null };
}

async function saveEmailsAndDeltaLocally(emails, deltaLink) {
  const filePath = path.join(__dirname, "emails.json");
  const data = {
    emails,
    deltaLink,
  };

  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log("Emails and delta link saved locally");
  } catch (error) {
    console.error("Error saving emails and delta link:", error);
    throw error;
  }
}

const syncEmails = async (msalClient, userId) => {
  const client = getAuthenticatedClient(msalClient, userId);

  const existingData = await loadExistingEmails();
  const existingEmails = existingData.emails;
  const deltaLink = existingData.deltaLink;

  try {
    const { emails: newEmails, newDeltaLink } = await getOutlookEmailsWithDelta(
      client,
      deltaLink
    );
    const updatedEmails = [...existingEmails, ...newEmails];
    saveEmailsAndDeltaLocally(updatedEmails, newDeltaLink);
  } catch (error) {
    console.error("Error syncing emails:", error);
  }
};

async function getOutlookEmailsWithDelta(client, deltaLink = null) {
  try {
    let response;
    if (deltaLink) {
      response = await client
        .api(deltaLink)
        .select("subject, from, isRead, flag")
        .get();
    } else {
      response = await client
        .api("/me/mailFolders/inbox/messages/delta")
        .select("subject, from, isRead, flag")
        .get();
    }

    const emails = response.value;
    const newDeltaLink =
      response["@odata.deltaLink"] || response["@odata.nextLink"];

    return { emails, newDeltaLink };
  } catch (error) {
    console.error("Error fetching emails with delta:", error);
    throw error;
  }
}

export {
  getAuthenticatedClient,
  getUserDetails,
  saveEmailsAndDeltaLocally,
  syncEmails,
  getOutlookEmailsWithDelta,
};
