import axios from "axios";

async function syncEmails(req, res) {
  const esClient = req.app.locals.esClient;
  console.log("##syncEmail##", { accessToken, userId });
  const url = "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages";
  const headers = { Authorization: `Bearer ${accessToken}` };

  try {
    const response = await axios.get(url, { headers });
    console.log({ headers });
    const emails = response.data.value;

    for (const email of emails) {
      await esClient.index({
        index: "email_messages",
        body: {
          userId,
          subject: email.subject,
          sender: email.from.emailAddress.address,
          timestamp: email.receivedDateTime,
          content: email.body.content,
        },
      });
    }
  } catch (error) {
    console.error("Error syncing emails:", error);
  }
}

export default syncEmails;
