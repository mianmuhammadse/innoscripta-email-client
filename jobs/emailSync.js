import { syncEmails } from "../graph.js";

const syncEmailJob = (client, userId) => {
  console.log("#JOB# Syn email job called");
  return () => {
    syncEmails(client, userId);
  };
};

export { syncEmailJob };
