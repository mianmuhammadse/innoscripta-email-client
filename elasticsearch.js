/**
 * {
  "id": "s1viqI8B7x2Qi4tK_sKE",
  "name": "email-client",
  "expiration": 1721709399684,
  "api_key": "IiQTnLiPSb6i_NYBDKOoCg",
  "encoded": "czF2aXFJOEI3eDJRaTR0S19zS0U6SWlRVG5MaVBTYjZpX05ZQkRLT29DZw==",
  "beats_logstash_format": "s1viqI8B7x2Qi4tK_sKE:IiQTnLiPSb6i_NYBDKOoCg"
}
 */

import { Client } from "@elastic/elasticsearch";
import { readFileSync } from "node:fs";

const client = new Client({
  node: process.env.ELASTIC_NODE,
  auth: {
    apiKey: {
      id: "s1viqI8B7x2Qi4tK_sKE",
      api_key: "IiQTnLiPSb6i_NYBDKOoCg",
    },
  },
  tls: {
    ca: readFileSync("./http_ca.crt"),
    rejectUnauthorized: true,
  },
});

client.ping({}, (error) => {
  if (error) {
    console.log("##ERROR##:", error);
  } else {
    console.log("Connected to elastic search");
  }
});

async function createIndices() {
  const indices = [
    {
      index: "email_messages",
      body: {
        mappings: {
          properties: {
            userId: { type: "keyword" },
            subject: { type: "text" },
            sender: { type: "text" },
          },
        },
      },
    },
    {
      index: "mailbox_details",
      body: {
        mappings: {
          properties: {
            userId: { type: "keyword" },
            mailboxName: { type: "text" },
            syncToken: { type: "text" },
          },
        },
      },
    },
  ];

  try {
    for (const index of indices) {
      const exists = await client.indices.exists({ index: index.index });
      if (!exists.body) {
        const indexResult = await client.indices.create({
          index: index.index,
          body: index.body,
        });
        console.log(`${index.index} result: ${indexResult}`);
      } else {
        console.log(`${index.index} already exists`);
      }
    }
  } catch (error) {
    console.log(
      "Error creating indicies: ",
      error.meta.body.error.root_cause[0].type
    );
  }
}

// createIndices();

export { client };
