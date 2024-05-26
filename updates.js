import express from "express";

const router = express.Router();

router.get("/updates", (res, req) => {
  res.set(
    "Content-Type",
    "text/event-stream",
    "Cache-Control",
    "no-cache",
    "Connection",
    "keep-alive"
  );

  const intervalId = setInterval(() => {
    res.write(`data: ${JSON.stringify({ message: "Update check" })}\n\n`);
  }, 5000);

  req.on("close", () => {
    clearInterval(intervalId);
  });
});

export { router };
