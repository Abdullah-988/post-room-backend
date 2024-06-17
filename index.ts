import express from "express";
import cors from "cors";
import "dotenv/config";

import usersRoute from "./routes/usersRoute";
import blogsRoute from "./routes/blogsRoute";

const port = process.env.PORT;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Authorization"],
  })
);

app.get("/", (req, res) => {
  return res.send("Post Room");
});

app.listen(port, () => {
  console.log(`App is listening to port: ${port}`);
});

app.use("/api", usersRoute);
app.use("/api", blogsRoute);
