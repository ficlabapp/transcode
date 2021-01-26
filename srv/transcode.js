"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const expressWS = require("express-ws");
const JSZip = require("jszip");
const RandomString = require("randomstring");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const app = express();
app.use(bodyParser.raw({ limit: "10mb", type: "application/epub+zip" }));
expressWS(app);
const port = 8080;

for (let path of ["/1/mobi", "/1/pdf", "/1/docx"]) {
    app.ws(path, handleSocketRequest);
}

app.listen(port, () => {
    console.log(`Listening for transcode requests on port ${port}`);
});

function handleSocketRequest(ws, request) {
    ws.on("message", async (message) => {
        let buf = await Buffer.from(message);
        let zip = await JSZip.loadAsync(buf);
        let file = await zip.file("META-INF/ficlab-settings.json");
        let id = await zip.file("META-INF/ficlab-id");
        if (file === null || !id) {
            return ws.send("Invalid EPUB file");
        }
        id = await id.async("string");
        let cfg = JSON.parse(await file.async("string"));
        console.log(`${cfg.id} ${cfg.format}`);
        let prefix = RandomString.generate(7);
        let inputFile = `${prefix}.epub`;
        fs.writeFile(`/tmp/${inputFile}`, buf, async (err) => {
            try {
                if (err) {
                    throw err;
                }

                let output = await (async () => {
                    switch (request.path) {
                        case "/1/mobi/.websocket":
                            return await toMOBI(cfg, inputFile);
                        case "/1/pdf/.websocket":
                            return await toPDF(cfg, inputFile);
                        case "/1/docx/.websocket":
                            return await toDOCX(cfg, inputFile);
                    }
                })();
                fs.readFile(`/tmp/${output.file}`, (err, data) => {
                    if (err) {
                        throw err;
                    }
                    ws.send(data);
                    ws.close();
                    fs.unlink(`/tmp/${output.file}`, () => {});
                });
            } catch (err) {
                ws.send(`Transcode error: ${err.message || err}`);
                ws.close();
            }

            fs.unlink(`/tmp/${inputFile}`, () => {});
        });
    });
}

async function toMOBI(cfg, filename, workDir = "/tmp") {
    return await new Promise((resolve, reject) => {
        let kindlegen = spawn("kindlegen", ["-o", `${filename}.mobi`, "-C0", filename], {
            cwd: workDir,
        });
        kindlegen.on("close", (status) => {
            if (status > 0 && !cfg.cover.enable) {
                try {
                    fs.accessSync(`${filename}.mobi`);
                    status = 0;
                } catch (e) {
                    status = -1;
                }
            }
            if (status > 0) {
                reject(new Error(`Unable to convert file (code: ${status})`));
            } else {
                resolve({
                    type: "application/vnd.amazon.ebook",
                    file: `${filename}.mobi`,
                });
            }
        });
        kindlegen.on("error", (err) => reject(err));
    });
}

async function toPDF(cfg, filename, workDir = "/tmp") {
    return await new Promise((resolve, reject) => {
        let calibre = spawn(
            "ebook-convert",
            [
                filename,
                `${filename}.pdf`,
                "--pdf-page-numbers",
                "--pdf-add-toc",
                "--preserve-cover-aspect-ratio",
                "--custom-size",
                "6.93x9.24",
                "--pdf-mono-family",
                "Liberation Mono",
                "--pdf-sans-family",
                "Liberation Sans",
                "--pdf-serif-family",
                "Liberation Serif",
                "--embed-all-fonts",
                "--subset-embedded-fonts",
                "--book-producer",
                "FicLab",
            ],
            { cwd: workDir }
        );
        calibre.on("close", (status) => {
            if (status > 0) {
                reject(new Error(`Unable to convert file (code: ${status})`));
            } else {
                resolve({
                    type: "application/pdf",
                    file: `${filename}.pdf`,
                });
            }
        });
        calibre.on("error", (err) => reject(err));
    });
}

async function toDOCX(cfg, filename, workDir = "/tmp") {
    return await new Promise((resolve, reject) => {
        let fontSize = `${cfg.book.size * 20}`;
        let calibre = spawn(
            "ebook-convert",
            [
                filename,
                `${filename}.docx`,
                "--prefer-metadata-cover",
                "--chapter-mark=pagebreak",
                "--book-producer",
                "FicLab",
            ],
            { cwd: workDir }
        );
        calibre.on("close", (status) => {
            if (status > 0) {
                reject(new Error(`Unable to convert file (code: ${status})`));
            } else {
                resolve({
                    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    file: `${filename}.docx`,
                });
            }
        });
        calibre.on("error", (err) => reject(err));
    });
}
