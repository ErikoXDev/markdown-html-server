const express = require("express");
const path = require("path");
const http = require("http");

const showdown = require("showdown");
const showdownHighlight = require("showdown-highlight");

const fs = require("fs");

const app = express();
const server = http.createServer(app);

// Get settings

const { FLAVOUR, ENABLE_README } = require("./markdown.config.js");

// Initialize Rendering
const hbs = require("hbs");
app.set("view engine", "html");
app.set("views", path.join(__dirname, "__markdown/views"));
app.engine("html", hbs.__express);
hbs.localsAsTemplateData(app);

// __markdown public route
app.use("/__markdown", express.static("__markdown/public"));

var taskListEnablerExtension = function () {
  return [
    {
      type: "output",
      regex: /<input type="checkbox" disabled(="")?/g,
      replace: '<input type="checkbox"',
    },
  ];
};

showdown.setFlavor(FLAVOUR);

// make the converter
var converter = new showdown.Converter({
  emoji: true,
  tasklists: true,
  simplifiedAutoLink: true,
  extensions: [showdownHighlight({}), taskListEnablerExtension],
});

// rendering the markdown
app.get("*", (req, res) => {
  let pathName = req.originalUrl;

  if (pathName == "/") {
    pathName = "/index.md";
  }

  let markdownFile = path.join(__dirname, pathName);

  if (pathName.toLowerCase().includes("readme")) {
    markdownFile = path.join(__dirname, "__markdown/404.md");
  }

  if (!fs.existsSync(markdownFile)) {
    markdownFile += ".md";
    if (!fs.existsSync(markdownFile)) {
      markdownFile = path.join(__dirname, "__markdown/404.md");
    }
  }

  let content = fs.readFileSync(markdownFile, "utf8");

  let html = converter.makeHtml(content);

  res.render("layout", { HTML: html });
});

const WebSocketServer = require("ws");
const wss = new WebSocketServer.Server({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

const chokidar = require("chokidar");
chokidar
  .watch(".", {
    cwd: path.join(__dirname),
  })
  .on("all", async (event, filepath) => {
    if (event === "change") {
      if (filepath.endsWith(".md")) {
        let markdown = fs.readFileSync(filepath).toString();

        let html = converter.makeHtml(markdown);

        const msg = {
          html: String(html),
          path: filepath,
        };

        for (const client of wss.clients) client.send(JSON.stringify(msg));
      }
    }
  });

server.listen(3000, () => {
  console.log("Server started at port 3000!");
});
