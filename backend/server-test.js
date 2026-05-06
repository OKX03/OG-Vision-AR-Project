const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Root OK");
});

app.get("/test", (req, res) => {
  res.send("Test OK");
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
