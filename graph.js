import { Client } from "@microsoft/microsoft-graph-client";

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

async function readEmails(msalClient, userId) {
  const client = getAuthenticatedClient(msalClient, userId);
  const messages = await client
    .api("/me/mailFolders/inbox/messages")
    .select("subject, from, receivedDateTime")
    .top(10)
    .get();
  return messages;
}

export { getUserDetails, readEmails };
